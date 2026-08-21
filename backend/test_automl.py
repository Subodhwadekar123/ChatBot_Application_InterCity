"""
AI Data Analyst - AutoML Studio Integration Test
===================================================
Tests all ML and AutoML endpoints:
1. Detect problem type (classification vs regression).
2. Train model V2 (classification - RandomForestClassifier).
3. Train model V2 (regression - RandomForestRegressor).
4. Tune hyperparameters (grid search).
5. Compare multiple models.
6. Save trained model pipeline to disk.
7. Run custom predictions using saved model.
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

def run_ml_tests():
    print("=" * 70)
    print("STARTING AUTOML STUDIO INTEGRATION TESTS")
    print("=" * 70)

    client = TestClient(app)
    
    # ── Test Credentials ──────────────────────────────────────────────────────
    test_email = "mltest@example.com"
    test_password = "SecurePassword123!"
    test_name = "ML Test Analyst"
    
    # Clean up any existing test user
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

    # Login
    login_resp = client.post("/api/v1/auth/login", json={
        "email": test_email,
        "password": test_password
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("PASS: Login completed and token retrieved.")

    # Upload Dataset
    sample_csv_path = "../sample_dataset.csv"
    if not os.path.exists(sample_csv_path):
        sample_csv_path = "sample_dataset.csv"
    
    with open(sample_csv_path, "rb") as f:
        upload_resp = client.post(
            "/api/v1/upload",
            files={"file": ("sample_dataset.csv", f, "text/csv")},
            headers=headers
        )
    assert upload_resp.status_code == 200, f"Upload failed: {upload_resp.text}"
    dataset_id = upload_resp.json()["dataset_id"]
    print(f"PASS: Mock dataset uploaded. ID: {dataset_id}")

    # ── 2. Detect Problem Type ────────────────────────────────────────────────
    # Test Category (Classification)
    detect_class_resp = client.get(f"/api/v1/ml/{dataset_id}/detect-problem/category", headers=headers)
    assert detect_class_resp.status_code == 200, f"Detect problem failed: {detect_class_resp.text}"
    print(f"PASS: Detect category problem type: {detect_class_resp.json()}")
    assert detect_class_resp.json()["problem_type"] == "classification"

    # Test Profit (Regression)
    detect_reg_resp = client.get(f"/api/v1/ml/{dataset_id}/detect-problem/profit", headers=headers)
    assert detect_reg_resp.status_code == 200, f"Detect problem failed: {detect_reg_resp.text}"
    print(f"PASS: Detect profit problem type: {detect_reg_resp.json()}")
    assert detect_reg_resp.json()["problem_type"] == "regression"

    # ── 3. Train Classification Model ─────────────────────────────────────────
    train_class_resp = client.post(
        f"/api/v1/ml/{dataset_id}/train-v2",
        json={
            "target_column": "category",
            "algorithm": "random_forest_classifier",
            "feature_columns": ["quantity", "unit_price", "region", "discount_pct"],
            "test_size": 0.2,
            "scaling_method": "auto",
            "imputation_strategy": "median",
            "stratify_split": True,
            "categorical_encoding": "onehot"
        },
        headers=headers
    )
    assert train_class_resp.status_code == 200, f"Train classification model failed: {train_class_resp.text}"
    class_res = train_class_resp.json()
    class_exp_id = class_res["experiment_id"]
    print(f"PASS: Train classification model succeeded. Exp ID: {class_exp_id}")
    print(f"Accuracy Summary: {class_res['accuracy_summary']}")

    # ── 4. Train Regression Model ─────────────────────────────────────────────
    train_reg_resp = client.post(
        f"/api/v1/ml/{dataset_id}/train-v2",
        json={
            "target_column": "profit",
            "algorithm": "random_forest_regressor",
            "feature_columns": ["quantity", "unit_price", "region", "discount_pct"],
            "test_size": 0.2,
            "scaling_method": "auto",
            "imputation_strategy": "median",
            "stratify_split": False,
            "categorical_encoding": "onehot"
        },
        headers=headers
    )
    assert train_reg_resp.status_code == 200, f"Train regression model failed: {train_reg_resp.text}"
    reg_res = train_reg_resp.json()
    reg_exp_id = reg_res["experiment_id"]
    print(f"PASS: Train regression model succeeded. Exp ID: {reg_exp_id}")
    print(f"Accuracy Summary: {reg_res['accuracy_summary']}")

    # ── 5. Tune Hyperparameters ───────────────────────────────────────────────
    tune_resp = client.post(
        f"/api/v1/ml/{dataset_id}/tune",
        json={
            "target_column": "profit",
            "algorithm": "random_forest_regressor",
            "feature_columns": ["quantity", "unit_price", "region", "discount_pct"],
            "test_size": 0.2,
            "scaling_method": "auto",
            "imputation_strategy": "median",
            "stratify_split": False,
            "categorical_encoding": "onehot"
        },
        headers=headers
    )
    assert tune_resp.status_code == 200, f"Hyperparameter tuning failed: {tune_resp.text}"
    tune_res = tune_resp.json()
    print(f"PASS: Hyperparameter tuning completed. Best params: {tune_res.get('best_params')}, Best CV Score: {tune_res.get('best_cv_score')}")

    # ── 6. Compare Multiple Models ────────────────────────────────────────────
    compare_resp = client.post(
        f"/api/v1/ml/{dataset_id}/compare",
        json={
            "target_column": "profit",
            "algorithms": ["random_forest_regressor", "linear_regression", "ridge"],
            "test_size": 0.2
        },
        headers=headers
    )
    assert compare_resp.status_code == 200, f"Compare models failed: {compare_resp.text}"
    compare_res = compare_resp.json()
    print(f"PASS: Compare models succeeded. Trained: {compare_res['n_models_trained']} models.")
    for comp in compare_res["comparison"]:
        print(f" - Model: {comp['algorithm']}, R2: {comp.get('cv_mean') or comp.get('error')}")

    # ── 7. Save Model Pipeline ────────────────────────────────────────────────
    save_resp = client.post(f"/api/v1/ml/{dataset_id}/save-pipeline/{reg_exp_id}", headers=headers)
    assert save_resp.status_code == 200, f"Save pipeline failed: {save_resp.text}"
    print(f"PASS: Saved pipeline details: {save_resp.json()}")

    # ── 8. Predict Custom Data ────────────────────────────────────────────────
    predict_resp = client.post(
        f"/api/v1/ml/{dataset_id}/predict/{reg_exp_id}",
        json={
            "inputs": {
                "quantity": 3,
                "unit_price": 200.0,
                "region": "North",
                "discount_pct": 10
            }
        },
        headers=headers
    )
    assert predict_resp.status_code == 200, f"Prediction failed: {predict_resp.text}"
    print(f"PASS: Custom prediction completed. Result: {predict_resp.json()}")

    # Clean up test user & dataset
    with db_session() as db:
        db.query(UserRecord).filter(UserRecord.email == test_email).delete()
        db.commit()
    
    print("\n" + "=" * 70)
    print("ALL AUTOML STUDIO FUNCTIONALITY VERIFICATION TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    run_ml_tests()
