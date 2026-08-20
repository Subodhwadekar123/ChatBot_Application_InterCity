"""
AI Data Analyst - SQL Workplace Integration Test
===================================================
Tests the SQL query engine router:
1. User registration & authentication to get a token.
2. Dataset upload (CSV) and registration.
3. Fetching SQL suggestions (rule-based).
4. Running SELECT queries (preview mode).
5. Running SELECT queries with apply_select_results=True (preprocessing).
6. Running modifying queries (UPDATE/DELETE) and verifying auto-update.
7. Reverting changes using the Undo API.
8. Testing invalid SQL syntax handling.
"""

import sys
import os
from contextlib import contextmanager

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, UserRecord, DatasetRecord
from app.services.data_service import DataService

@contextmanager
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_sql_tests():
    print("=" * 70)
    print("STARTING SQL WORKPLACE INTEGRATION TESTS")
    print("=" * 70)

    client = TestClient(app)
    
    # ── Test Credentials ──────────────────────────────────────────────────────
    test_email = "sqltest@example.com"
    test_password = "SecurePassword123!"
    test_name = "SQL Test Analyst"
    
    # Clean up any existing test user from previous aborted runs
    with db_session() as db:
        db.query(UserRecord).filter(UserRecord.email == test_email).delete()
        db.commit()

    # ── 1. Register User ──────────────────────────────────────────────────────
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": test_email,
        "password": test_password,
        "full_name": test_name
    })
    assert reg_resp.status_code in (200, 201), f"Registration failed: {reg_resp.text}"
    print("PASS: User registered successfully.")

    # ── 2. Login to get Access Token ──────────────────────────────────────────
    login_resp = client.post("/api/v1/auth/login", json={
        "email": test_email,
        "password": test_password
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("PASS: Login completed and token retrieved.")

    # ── 3. Upload Sample Dataset ──────────────────────────────────────────────
    csv_content = "name,age,salary,city\nAlice,30,85000.0,New York\nBob,25,60000.0,Chicago\nCharlie,35,95000.0,Los Angeles\nDiana,40,110000.0,Seattle"
    files = {"file": ("test_sql_dataset.csv", csv_content, "text/csv")}
    upload_resp = client.post("/api/v1/upload", files=files, headers=headers)
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    dataset_id = upload_resp.json()["dataset_id"]
    print(f"PASS: Mock dataset uploaded. ID: {dataset_id}")

    try:
        # ── 4. Get SQL Suggestions ────────────────────────────────────────────
        sug_resp = client.get(f"/api/v1/sql/{dataset_id}/suggest", headers=headers)
        assert sug_resp.status_code == 200, f"Suggestions failed: {sug_resp.text}"
        sug_data = sug_resp.json()
        assert "suggestions" in sug_data
        assert len(sug_data["suggestions"]) >= 1
        print(f"PASS: Retained suggestions. Primary: '{sug_data['suggestions'][0]['title']}'")

        # ── 5. Execute Read-Only SELECT Query (Preview Mode) ──────────────────
        select_query = "SELECT name, salary FROM dataset WHERE age > 28"
        query_resp = client.post(f"/api/v1/sql/{dataset_id}/execute", json={
            "query": select_query,
            "apply_select_results": False
        }, headers=headers)
        assert query_resp.status_code == 200, f"Select failed: {query_resp.text}"
        query_data = query_resp.json()
        assert query_data["is_select"] is True
        assert query_data["applied"] is False
        assert len(query_data["preview"]) == 3  # Alice, Charlie, Diana
        assert "salary" in query_data["columns"]
        
        # Verify original dataset was NOT modified
        df_original = DataService.get_dataframe(dataset_id)
        assert len(df_original) == 4  # Still 4 rows
        assert len(df_original.columns) == 4  # Still 4 columns
        print("PASS: SELECT preview completed without changing active dataset.")

        # ── 6. Execute SELECT Query with Preprocessing Apply ──────────────────
        preprocess_query = "SELECT name, age FROM dataset WHERE age >= 30"
        preprocess_resp = client.post(f"/api/v1/sql/{dataset_id}/execute", json={
            "query": preprocess_query,
            "apply_select_results": True
        }, headers=headers)
        assert preprocess_resp.status_code == 200, f"Preprocessing failed: {preprocess_resp.text}"
        preprocess_data = preprocess_resp.json()
        assert preprocess_data["applied"] is True
        assert preprocess_data["rows_count"] == 3  # Alice, Charlie, Diana
        assert len(preprocess_data["columns"]) == 2  # name, age
        
        # Verify changes ARE updated in main database record and DataService
        df_modified = DataService.get_dataframe(dataset_id)
        assert len(df_modified) == 3
        assert list(df_modified.columns) == ["name", "age"]
        
        # Verify SQL history tracking (undo availability)
        history_resp = client.get(f"/api/v1/cleaning/{dataset_id}/history-status", headers=headers)
        assert history_resp.json()["undo_count"] == 1
        print("PASS: SELECT preprocessing applied changes and registered in history.")

        # ── 7. Execute Modifying DML Query (UPDATE) ───────────────────────────
        update_query = "UPDATE dataset SET age = age + 10 WHERE name = 'Alice'"
        update_resp = client.post(f"/api/v1/sql/{dataset_id}/execute", json={
            "query": update_query
        }, headers=headers)
        assert update_resp.status_code == 200, f"Update failed: {update_resp.text}"
        
        # Verify changes were immediately applied
        df_updated = DataService.get_dataframe(dataset_id)
        alice_age = df_updated[df_updated["name"] == "Alice"]["age"].values[0]
        assert alice_age == 40  # 30 + 10
        
        # Verify history count is now 2
        history_resp = client.get(f"/api/v1/cleaning/{dataset_id}/history-status", headers=headers)
        assert history_resp.json()["undo_count"] == 2
        print("PASS: Modifying query (UPDATE) executed and directly applied.")

        # ── 8. Test Revert Changes (Undo) ─────────────────────────────────────
        undo_resp = client.post(f"/api/v1/cleaning/{dataset_id}/undo", headers=headers)
        assert undo_resp.status_code == 200, f"Undo failed: {undo_resp.text}"
        
        # Verify Alice age reverted back to 30
        df_undone = DataService.get_dataframe(dataset_id)
        alice_age_undone = df_undone[df_undone["name"] == "Alice"]["age"].values[0]
        assert alice_age_undone == 30
        print("PASS: Undo reverted last SQL modification correctly.")

        # ── 9. Test Invalid SQL Syntax Error Handling ─────────────────────────
        bad_query = "SELECT * FROM non_existent_table"
        bad_resp = client.post(f"/api/v1/sql/{dataset_id}/execute", json={
            "query": bad_query
        }, headers=headers)
        assert bad_resp.status_code == 400
        assert "non_existent_table" in bad_resp.json()["detail"]
        print("PASS: Invalid query caught and error details returned.")

    finally:
        # ── Cleanup ───────────────────────────────────────────────────────────
        with db_session() as db:
            # Delete dataset record
            db.query(DatasetRecord).filter(DatasetRecord.id == dataset_id).delete()
            # Delete user record
            db.query(UserRecord).filter(UserRecord.email == test_email).delete()
            db.commit()
            
        # Clean up files from uploads folder
        DataService.remove_dataframe(dataset_id)
        stored_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads", f"{dataset_id}.csv")
        if os.path.exists(stored_path):
            os.remove(stored_path)
            
        print("PASS: Cleanup completed.")

    print("\n" + "=" * 70)
    print("ALL 9 SQL WORKPLACE INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_sql_tests()
