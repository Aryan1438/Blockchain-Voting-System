//import "../css/style.css"

const Web3 = require('web3');
const contract = require('@truffle/contract');

const votingArtifacts = require('../../build/contracts/Voting.json');
var VotingContract = contract(votingArtifacts)


window.App = {
  account: null,
  instance: null,

  getVotingWindowStatus: async function() {
    const result = await App.instance.getDates();
    const start = Number(result[0]);
    const end = Number(result[1]);
    const now = Math.floor(Date.now() / 1000);

    if (start === 0 || end === 0) {
      return { open: false, message: "Voting dates are not set by admin." };
    }

    if (now < start) {
      return { open: false, message: "Voting has not started yet." };
    }

    if (now >= end) {
      return { open: false, message: "Voting has already ended." };
    }

    return { open: true, message: "Voting is open." };
  },

  ensureGanacheNetwork: async function() {
    const targetChainId = '0x539'; // 1337
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });

    if (currentChainId === targetChainId) {
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: targetChainId,
            chainName: 'Ganache Local 1337',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['http://127.0.0.1:7545']
          }]
        });
      } else {
        throw switchError;
      }
    }
  },

  eventStart: async function() {
    try {
      if (!window.ethereum) {
        alert("MetaMask not found. Please install MetaMask and connect to Localhost 7545.");
        return;
      }

      await App.ensureGanacheNetwork();

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      App.account = accounts && accounts.length ? accounts[0] : null;

      VotingContract.setProvider(window.ethereum)
      VotingContract.defaults({ from: App.account })

      $("#accountAddress").html("Your Account: " + (App.account || "Not connected"));

      App.instance = await VotingContract.deployed();
      await App.renderCandidates();
      await App.renderDates();

      const voted = await App.instance.checkVote({ from: App.account });
      const votingWindow = await App.getVotingWindowStatus();

      if (!voted && votingWindow.open) {
        $("#voteButton").attr("disabled", false);
      } else {
        $("#voteButton").attr("disabled", true);
        if (!votingWindow.open) {
          $("#msg").html("<p>" + votingWindow.message + "</p>");
        } else if (voted) {
          $("#msg").html("<p>You have already voted.</p>");
        }
      }

      $('#addCandidate').click(async function() {
        const nameCandidate = $('#name').val().trim();
        const partyCandidate = $('#party').val().trim();

        if (!nameCandidate || !partyCandidate) {
          alert("Please enter candidate name and party.");
          return;
        }

        try {
          await App.instance.addCandidate(nameCandidate, partyCandidate, {
            from: App.account,
            gas: 250000
          });
          window.location.reload();
        } catch (err) {
          console.error("ERROR! " + err.message)
          alert("Failed to add candidate: " + (err.message || "Unknown error") + "\n\nCheck: MetaMask unlocked, selected account funded, and network is 1337.");
        }
      });

      $('#addDate').click(async function() {
        const startRaw = document.getElementById("startDate").value;
        const endRaw = document.getElementById("endDate").value;
        const startDate = Math.floor(Date.parse(startRaw) / 1000);
        const endDate = Math.floor(Date.parse(endRaw) / 1000);

        if (!startRaw || !endRaw || Number.isNaN(startDate) || Number.isNaN(endDate)) {
          alert("Please choose valid start and end dates.");
          return;
        }

        try {
          await App.instance.setDates(startDate, endDate, {
            from: App.account,
            gas: 200000
          });
          await App.renderDates();
        } catch (err) {
          console.error("ERROR! " + err.message)
          alert("Failed to set dates. Start date must be close to current time and end date must be after start date.");
        }
      });

      window.ethereum.on('accountsChanged', function(accountsChanged) {
        App.account = accountsChanged && accountsChanged.length ? accountsChanged[0] : null;
        window.location.reload();
      });

      window.ethereum.on('chainChanged', function() {
        window.location.reload();
      });
    } catch (err) {
      console.error("ERROR! " + err.message)
    }
  },

  renderCandidates: async function() {
    const countCandidatesRaw = await App.instance.getCountCandidates();
    const countCandidates = Number(countCandidatesRaw);

    $("#boxCandidate").empty();

    for (let i = 1; i <= countCandidates; i++) {
      const data = await App.instance.getCandidate(i);
      const id = Number(data[0]);
      const name = data[1];
      const party = data[2];
      const voteCount = Number(data[3]);
      const viewCandidates = `<tr><td><input class="form-check-input" type="radio" name="candidate" value="${id}" id="${id}"> ${name}</td><td>${party}</td><td>${voteCount}</td></tr>`
      $("#boxCandidate").append(viewCandidates)
    }
  },

  renderDates: async function() {
    try {
      const result = await App.instance.getDates();
      const startDate = new Date(Number(result[0]) * 1000);
      const endDate = new Date(Number(result[1]) * 1000);

      if (Number(result[0]) === 0 || Number(result[1]) === 0) {
        $("#dates").text("Not set");
        return;
      }

      $("#dates").text(startDate.toDateString() + " - " + endDate.toDateString());
    } catch (err) {
      console.error("ERROR! " + err.message)
    }
  },

  vote: async function() {    
    var candidateID = $("input[name='candidate']:checked").val();
    if (!candidateID) {
      $("#msg").html("<p>Please vote for a candidate.</p>")
      return
    }
    try {
      const votingWindow = await App.getVotingWindowStatus();
      if (!votingWindow.open) {
        $("#msg").html("<p>" + votingWindow.message + "</p>");
        return;
      }

      const instance = await VotingContract.deployed();
      await instance.vote(parseInt(candidateID), {
        from: App.account,
        gas: 200000
      });

      $("#voteButton").attr("disabled", true);
      $("#msg").html("<p>Vote confirmed.</p>");
      window.location.reload(1);
    } catch (err) {
      console.error("ERROR! " + err.message)
      $("#msg").html("<p>Vote failed: " + (err.message || "Unknown error") + "</p>");
    }
  }
}

window.addEventListener("load", function() {
  if (typeof web3 !== "undefined") {
    console.warn("Using web3 detected from external source like Metamask")
    window.eth = new Web3(window.ethereum)
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:7545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for deployment.")
    window.eth = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"))
  }
  window.App.eventStart()
})
