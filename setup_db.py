"""One-time database setup script for the Decentralized Voting System."""
import getpass
import sys
import uuid
import re

try:
    import mysql.connector
    from mysql.connector import errorcode
except ImportError:
    print("Installing mysql-connector-python...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "mysql-connector-python"])
    import mysql.connector
    from mysql.connector import errorcode

print("\n=== Decentralized Voting System - Database Setup ===\n")
host = input("MySQL host [127.0.0.1]: ").strip() or "127.0.0.1"
user = input("MySQL username [root]: ").strip() or "root"
password = getpass.getpass("MySQL password: ")

# 1. Connect & create database
try:
    cnx = mysql.connector.connect(host=host, user=user, password=password)
    cursor = cnx.cursor()
    print("\n[OK] Connected to MySQL")
except mysql.connector.Error as err:
    if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
        print("[ERROR] Wrong username or password.")
    else:
        print(f"[ERROR] {err}")
    sys.exit(1)

cursor.execute("CREATE DATABASE IF NOT EXISTS voter_db;")
cursor.execute("USE voter_db;")
print("[OK] Database 'voter_db' ready")

# 2. Create voters table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS voters (
        voter_id VARCHAR(36) PRIMARY KEY NOT NULL,
        role ENUM('admin', 'user') NOT NULL,
        password VARCHAR(255) NOT NULL
    );
""")
print("[OK] Table 'voters' created")

# 3. Check if table already has rows
cursor.execute("SELECT COUNT(*) FROM voters;")
count = cursor.fetchone()[0]
if count == 0:
    # Insert sample admin and user
    admin_id = str(uuid.uuid4())
    user_id  = str(uuid.uuid4())
    cursor.execute("INSERT INTO voters (voter_id, role, password) VALUES (%s, 'admin', %s)", (admin_id, "admin123"))
    cursor.execute("INSERT INTO voters (voter_id, role, password) VALUES (%s, 'user',  %s)", (user_id,  "user123"))
    cnx.commit()
    print(f"\n[OK] Sample accounts inserted:")
    print(f"     Admin -> voter_id: {admin_id}  password: admin123")
    print(f"     User  -> voter_id: {user_id}   password: user123")
    print("\n  Keep these credentials — you'll use them to log in!")
else:
    print(f"[OK] Table already has {count} row(s), skipping sample insert.")

cursor.close()
cnx.close()

# 4. Update Database_API/.env
env_path = r"f:\BC_Voting\Database_API\.env"
with open(env_path, "r") as f:
    content = f.read()

content = re.sub(r'MYSQL_USER=".*"',     f'MYSQL_USER="{user}"',     content)
content = re.sub(r'MYSQL_PASSWORD=".*"', f'MYSQL_PASSWORD="{password}"', content)
content = re.sub(r'MYSQL_HOST=".*"',     f'MYSQL_HOST="{host}"',     content)
content = re.sub(r'MYSQL_DB=".*"',       'MYSQL_DB="voter_db"',      content)

with open(env_path, "w") as f:
    f.write(content)
print("\n[OK] Database_API/.env updated with your credentials")
print("\n=== Setup Complete! ===")
