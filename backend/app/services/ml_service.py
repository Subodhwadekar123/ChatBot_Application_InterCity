"""
AI Data Analyst - Machine Learning Service
============================================
Auto-detects problem type, builds robust end-to-end pipelines (scaling, encoding,
imputation, feature engineering), and trains high-accuracy ML models.

Supports:
  Regression: Random Forest, Gradient Boosting, XGBoost, LightGBM, Ridge, Linear, Lasso, SVR
  Classification: Random Forest, Gradient Boosting, XGBoost, LightGBM, Logistic, Decision Tree, SVC, KNN, Naive Bayes
  Clustering: KMeans, DBSCAN, Agglomerative, Gaussian Mixture
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
import uuid
import re

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold, KFold
from sklearn.preprocessing import LabelEncoder, StandardScaler, RobustScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report,
    mean_squared_error, mean_absolute_error, r2_score,
    silhouette_score,
)

# Regression models
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR

# Classification models
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import SVC
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier

# Clustering models
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture

# Optional: XGBoost / LightGBM
try:
    from xgboost import XGBRegressor, XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False

from app.services.data_service import DataService
from app.utils.cache import analysis_cache
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class MLService:
    """Machine Learning service with auto-detection, robust preprocessing pipelines, and evaluation."""

    _trained_models: Dict[str, Any] = {}

    # ── Auto-Detect Problem Type ──────────────────────────────────────────────

    @staticmethod
    def detect_problem_type(dataset_id: str, target_column: str) -> Dict[str, Any]:
        """
        Automatically detect whether the problem is regression or classification.
        """
        df = DataService.get_dataframe(dataset_id)
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found")

        target = df[target_column].dropna()
        n_unique = target.nunique()
        dtype = target.dtype

        # Classification if string, object, bool, category, or low-cardinality discrete numeric
        if not pd.api.types.is_numeric_dtype(dtype):
            problem_type = "classification"
            reason = f"Categorical target with {n_unique} distinct classes"
        else:
            # Check if numeric target is discrete/classification (e.g., 0/1, ratings 1-5, or <= 15 unique classes)
            is_integer_like = False
            try:
                numeric_vals = target.dropna()
                if (numeric_vals % 1 == 0).all() and n_unique <= 15:
                    is_integer_like = True
            except Exception:
                pass

            if n_unique <= 15 and is_integer_like:
                problem_type = "classification"
                reason = f"Discrete numeric target with only {n_unique} unique integer classes"
            elif n_unique == 2:
                problem_type = "classification"
                reason = f"Binary target with 2 distinct values ({list(target.unique())})"
            else:
                problem_type = "regression"
                reason = f"Continuous numeric target with {n_unique} distinct values"

        algorithms = MLService._recommend_algorithms(problem_type)

        return {
            "problem_type": problem_type,
            "reason": reason,
            "target_column": target_column,
            "n_unique_targets": int(n_unique),
            "target_dtype": str(dtype),
            "recommended_algorithms": algorithms,
        }

    @staticmethod
    def _recommend_algorithms(problem_type: str) -> List[Dict[str, str]]:
        """Return recommended algorithms ranked by typical real-world accuracy."""
        if problem_type == "regression":
            algos = [
                {"id": "random_forest_regressor", "name": "Random Forest Regressor", "description": "High-accuracy ensemble of decision trees (Top Recommendation)"},
                {"id": "gradient_boosting_regressor", "name": "Gradient Boosting Regressor", "description": "Sequential boosting model, excels on complex non-linear patterns"},
                {"id": "ridge", "name": "Ridge Regression (L2 Regularized)", "description": "Standardized linear model with L2 penalty, robust against collinearity"},
                {"id": "linear_regression", "name": "Linear Regression", "description": "Standard linear regression baseline with feature scaling"},
                {"id": "lasso", "name": "Lasso Regression (L1 Regularized)", "description": "Sparse linear regression with built-in feature selection"},
                {"id": "svr", "name": "Support Vector Regressor (SVR)", "description": "Kernel-based regression with RBF support vectors"},
            ]
            if XGBOOST_AVAILABLE:
                algos.insert(1, {"id": "xgboost_regressor", "name": "XGBoost Regressor", "description": "Extreme gradient boosting, industry standard for tabular data"})
            if LIGHTGBM_AVAILABLE:
                algos.insert(2, {"id": "lightgbm_regressor", "name": "LightGBM Regressor", "description": "Fast tree-based boosting algorithm"})
        elif problem_type == "classification":
            algos = [
                {"id": "random_forest_classifier", "name": "Random Forest Classifier", "description": "High-accuracy ensemble of trees (Top Recommendation)"},
                {"id": "gradient_boosting_classifier", "name": "Gradient Boosting Classifier", "description": "Sequential boosted trees, superior predictive power"},
                {"id": "logistic_regression", "name": "Logistic Regression (Standardized)", "description": "Standardized regularized classification baseline"},
                {"id": "decision_tree", "name": "Decision Tree", "description": "Interpretable tree classifier with non-linear splits"},
                {"id": "svc", "name": "Support Vector Classifier (SVC)", "description": "Kernelized SVM with probability estimates"},
                {"id": "knn", "name": "K-Nearest Neighbors (KNN)", "description": "Distance-based instance classifier with standard scaling"},
                {"id": "naive_bayes", "name": "Gaussian Naive Bayes", "description": "Probabilistic Bayesian classifier"},
            ]
            if XGBOOST_AVAILABLE:
                algos.insert(1, {"id": "xgboost_classifier", "name": "XGBoost Classifier", "description": "State-of-the-art gradient boosted classification"})
            if LIGHTGBM_AVAILABLE:
                algos.insert(2, {"id": "lightgbm_classifier", "name": "LightGBM Classifier", "description": "High-speed leaf-wise gradient boosting"})
        else:
            algos = [
                {"id": "kmeans", "name": "K-Means Clustering", "description": "Centroid-based spatial clustering"},
                {"id": "gaussian_mixture", "name": "Gaussian Mixture Model (GMM)", "description": "Soft probabilistic clustering with EM algorithm"},
                {"id": "agglomerative", "name": "Hierarchical Agglomerative", "description": "Bottom-up tree-based clustering"},
                {"id": "dbscan", "name": "DBSCAN (Density-Based)", "description": "Finds arbitrarily shaped clusters and filters noise"},
            ]
        return algos

    # ── Train Model ───────────────────────────────────────────────────────────

    @staticmethod
    def train_model(
        dataset_id: str,
        target_column: str,
        algorithm: str,
        feature_columns: Optional[List[str]] = None,
        test_size: float = 0.2,
        n_clusters: int = 3,
    ) -> Dict[str, Any]:
        """
        Train an ML model with automated preprocessing, feature scaling, one-hot encoding,
        missing-value imputation, and percentage accuracy evaluation.
        """
        df = DataService.get_dataframe(dataset_id).copy()
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset")

        # Detect problem type
        problem_type_info = MLService.detect_problem_type(dataset_id, target_column)
        problem_type = problem_type_info["problem_type"]

        # Drop rows where target is NaN
        valid_mask = df[target_column].notna()
        df = df[valid_mask].copy()

        if len(df) < 15:
            raise ValueError("Not enough data to train a model (need at least 15 non-empty rows)")

        # Downsample for quick training if dataset is huge (> 10,000 rows)
        if len(df) > 10000:
            df = df.sample(n=10000, random_state=42)

        # ── Feature Selection & Filtering ──
        if feature_columns:
            candidate_cols = [c for c in feature_columns if c in df.columns and c != target_column]
        else:
            candidate_cols = [c for c in df.columns if c != target_column]

        # Filter out high-cardinality text / ID columns
        num_cols = []
        cat_cols = []
        for c in candidate_cols:
            col_series = df[c]
            # Skip pure ID or UUID columns (e.g. unique per row or id names)
            c_lower = c.lower()
            if c_lower in ("id", "uuid", "_id", "index", "row_id", "transaction_id", "customer_id", "user_id") and col_series.nunique() > len(df) * 0.8:
                continue
            
            if pd.api.types.is_numeric_dtype(col_series.dtype):
                num_cols.append(c)
            elif pd.api.types.is_datetime64_any_dtype(col_series.dtype):
                # Extract datetime features
                df[f"{c}_year"] = col_series.dt.year
                df[f"{c}_month"] = col_series.dt.month
                df[f"{c}_day"] = col_series.dt.day
                num_cols.extend([f"{c}_year", f"{c}_month", f"{c}_day"])
            else:
                # Categorical column
                n_uniq = col_series.nunique()
                # Include categorical if cardinality is manageable (<= 60 distinct values)
                if 1 < n_uniq <= 60:
                    cat_cols.append(c)

        if not num_cols and not cat_cols:
            raise ValueError("No valid predictive features found in the dataset")

        X = df[num_cols + cat_cols].copy()
        y = df[target_column].copy()

        # Handle clustering
        if algorithm in ("kmeans", "dbscan", "agglomerative", "gaussian_mixture"):
            return MLService._train_clustering(dataset_id, X, num_cols, algorithm, n_clusters)

        # ── Target Encoding (Classification) ──
        le = None
        label_mapping = {}
        if problem_type == "classification":
            le = LabelEncoder()
            y_encoded = pd.Series(le.fit_transform(y.astype(str)), index=y.index)
            label_mapping = {int(idx): str(cls_name) for idx, cls_name in enumerate(le.classes_)}
        else:
            # Ensure target is float
            y_encoded = pd.to_numeric(y, errors="coerce")
            valid_y = y_encoded.notna()
            X = X[valid_y]
            y_encoded = y_encoded[valid_y]

        # ── Train / Test Split ──
        stratify = y_encoded if (problem_type == "classification" and y_encoded.value_counts().min() >= 2) else None
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, test_size=test_size, random_state=42, stratify=stratify
        )

        # ── Build Preprocessing Pipeline ──
        transformers = []
        if num_cols:
            num_pipeline = Pipeline([
                ("imputer", SimpleImputer(strategy="median")),
                ("scaler", StandardScaler()),
            ])
            transformers.append(("num", num_pipeline, num_cols))

        if cat_cols:
            cat_pipeline = Pipeline([
                ("imputer", SimpleImputer(strategy="most_frequent")),
                ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ])
            transformers.append(("cat", cat_pipeline, cat_cols))

        preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

        # ── Base Estimator ──
        base_model = MLService._get_model(algorithm)

        # Full end-to-end Pipeline
        model_pipeline = Pipeline([
            ("preprocessor", preprocessor),
            ("model", base_model),
        ])

        # ── Fit Pipeline ──
        model_pipeline.fit(X_train, y_train)
        y_pred = model_pipeline.predict(X_test)

        # ── Compute Evaluation Metrics ──
        if problem_type == "regression":
            metrics = MLService._regression_metrics(y_test, y_pred)
        else:
            metrics = MLService._classification_metrics(y_test, y_pred, model_pipeline, X_test)

        # ── Feature Importances ──
        importances = MLService._extract_feature_importances(model_pipeline, num_cols, cat_cols)

        # ── Cross-Validation ──
        cv_scores = []
        try:
            cv_splitter = StratifiedKFold(n_splits=3, shuffle=True, random_state=42) if problem_type == "classification" else KFold(n_splits=3, shuffle=True, random_state=42)
            scoring = "r2" if problem_type == "regression" else "accuracy"
            cv_scores = cross_val_score(model_pipeline, X, y_encoded, cv=cv_splitter, scoring=scoring, n_jobs=-1).tolist()
        except Exception as e:
            logger.warning(f"Cross-validation warning: {e}")

        # ── Predictions Preview Table ──
        predictions_preview = []
        n_preview = min(15, len(y_test))
        y_test_arr = np.array(y_test)
        y_pred_arr = np.array(y_pred)
        X_test_reset = X_test.reset_index(drop=True)

        if problem_type == "classification":
            for i in range(n_preview):
                act_val = label_mapping.get(int(y_test_arr[i]), str(y_test_arr[i])) if label_mapping else str(y_test_arr[i])
                pred_val = label_mapping.get(int(y_pred_arr[i]), str(y_pred_arr[i])) if label_mapping else str(y_pred_arr[i])
                is_match = (y_test_arr[i] == y_pred_arr[i])
                predictions_preview.append({
                    "row_id": i + 1,
                    "actual": act_val,
                    "predicted": pred_val,
                    "is_correct": bool(is_match),
                    "status": "Match" if is_match else "Mismatch",
                    "features": {k: round(float(v), 2) if isinstance(v, (int, float, np.number)) else str(v) for k, v in X_test_reset.iloc[i].to_dict().items()}
                })
        else:
            for i in range(n_preview):
                act = float(y_test_arr[i])
                pred = float(y_pred_arr[i])
                diff = pred - act
                denom = abs(act) if abs(act) > 1e-6 else 1.0
                err_pct = abs(diff) / denom * 100.0
                is_close = (err_pct <= 15.0)
                predictions_preview.append({
                    "row_id": i + 1,
                    "actual": round(act, 4),
                    "predicted": round(pred, 4),
                    "difference": round(diff, 4),
                    "error_pct": round(err_pct, 2),
                    "is_correct": bool(is_close),
                    "status": f"{err_pct:.1f}% error",
                    "features": {k: round(float(v), 2) if isinstance(v, (int, float, np.number)) else str(v) for k, v in X_test_reset.iloc[i].to_dict().items()}
                })

        # ── Overall Percentage Accuracy Summary ──
        if problem_type == "classification":
            acc_pct = round(metrics.get("accuracy", 0.0) * 100.0, 2)
            prec_pct = round(metrics.get("precision", 0.0) * 100.0, 2)
            rec_pct = round(metrics.get("recall", 0.0) * 100.0, 2)
            f1_pct = round(metrics.get("f1_score", 0.0) * 100.0, 2)
            rating = "Outstanding" if acc_pct >= 90 else ("Good" if acc_pct >= 75 else ("Moderate" if acc_pct >= 60 else "Needs Tuning"))
            accuracy_summary = {
                "overall_accuracy_pct": acc_pct,
                "precision_pct": prec_pct,
                "recall_pct": rec_pct,
                "f1_pct": f1_pct,
                "rating": rating,
                "headline": f"{acc_pct}% Overall Classification Accuracy"
            }
        else:
            r2_val = metrics.get("r2_score", 0.0)
            r2_pct = round(max(0.0, r2_val * 100.0), 2)
            acts = np.array(y_test)
            preds = np.array(y_pred)
            rel_errors = np.abs(preds - acts) / np.maximum(np.abs(acts), 1e-6)
            within_10_pct = round(float(np.mean(rel_errors <= 0.10) * 100.0), 2)
            within_20_pct = round(float(np.mean(rel_errors <= 0.20) * 100.0), 2)
            mape_pct = round(float(np.mean(rel_errors) * 100.0), 2)
            rating = "Outstanding" if r2_pct >= 85 else ("Good" if r2_pct >= 70 else ("Moderate" if r2_pct >= 50 else "Needs Tuning"))
            accuracy_summary = {
                "overall_accuracy_pct": r2_pct,
                "r2_variance_explained_pct": r2_pct,
                "within_10pct_accuracy": within_10_pct,
                "within_20pct_accuracy": within_20_pct,
                "mape_pct": mape_pct,
                "rating": rating,
                "headline": f"{r2_pct}% Fit Rate (R² Variance Explained)"
            }

        experiment_id = str(uuid.uuid4())

        # Cache trained pipeline
        MLService._trained_models[experiment_id] = {
            "pipeline": model_pipeline,
            "feature_columns": num_cols + cat_cols,
            "num_cols": num_cols,
            "cat_cols": cat_cols,
            "problem_type": problem_type,
            "label_mapping": label_mapping,
        }

        return {
            "experiment_id": experiment_id,
            "algorithm": algorithm,
            "problem_type": problem_type,
            "target_column": target_column,
            "feature_columns": num_cols + cat_cols,
            "n_samples_train": int(len(X_train)),
            "n_samples_test": int(len(X_test)),
            "accuracy_summary": accuracy_summary,
            "predictions_preview": predictions_preview,
            "metrics": metrics,
            "feature_importances": importances,
            "cross_validation": {
                "scores": [round(s, 4) for s in cv_scores],
                "mean": round(float(np.mean(cv_scores)), 4) if cv_scores else None,
                "std": round(float(np.std(cv_scores)), 4) if cv_scores else None,
            },
            "label_mapping": label_mapping,
        }

    # ── Model Instances ───────────────────────────────────────────────────────

    @staticmethod
    def _get_model(algorithm: str):
        """Return optimized model instance with robust hyperparameter configurations."""
        models = {}

        # Regression Models
        models["random_forest_regressor"] = RandomForestRegressor(
            n_estimators=100, max_depth=15, min_samples_split=4, min_samples_leaf=2, random_state=42, n_jobs=-1
        )
        models["gradient_boosting_regressor"] = GradientBoostingRegressor(
            n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
        )
        models["linear_regression"] = LinearRegression()
        models["ridge"] = Ridge(alpha=1.0)
        models["lasso"] = Lasso(alpha=0.1, max_iter=2000)
        models["elasticnet"] = ElasticNet(alpha=0.1, l1_ratio=0.5, max_iter=2000)
        models["svr"] = SVR(C=1.0, epsilon=0.1)

        # Classification Models
        models["random_forest_classifier"] = RandomForestClassifier(
            n_estimators=100, max_depth=15, min_samples_split=4, min_samples_leaf=2, random_state=42, n_jobs=-1
        )
        models["gradient_boosting_classifier"] = GradientBoostingClassifier(
            n_estimators=100, max_depth=5, learning_rate=0.1, random_state=42
        )
        models["logistic_regression"] = LogisticRegression(max_iter=1000, C=1.0, random_state=42)
        models["decision_tree"] = DecisionTreeClassifier(max_depth=10, min_samples_split=4, random_state=42)
        models["svc"] = SVC(probability=True, C=1.0, kernel="rbf", random_state=42)
        models["naive_bayes"] = GaussianNB()
        models["knn"] = KNeighborsClassifier(n_neighbors=5, n_jobs=-1)

        if XGBOOST_AVAILABLE:
            models["xgboost_regressor"] = XGBRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, verbosity=0, n_jobs=-1)
            models["xgboost_classifier"] = XGBClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, verbosity=0, eval_metric="logloss", n_jobs=-1)

        if LIGHTGBM_AVAILABLE:
            models["lightgbm_classifier"] = LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, verbose=-1, n_jobs=-1)
            models["lightgbm_regressor"] = LGBMRegressor(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, verbose=-1, n_jobs=-1)

        if algorithm not in models:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        return models[algorithm]

    # ── Evaluation Metrics ────────────────────────────────────────────────────

    @staticmethod
    def _regression_metrics(y_true, y_pred) -> Dict[str, Any]:
        """Compute comprehensive regression metrics."""
        mse = float(mean_squared_error(y_true, y_pred))
        rmse = float(np.sqrt(mse))
        mae = float(mean_absolute_error(y_true, y_pred))
        r2 = float(r2_score(y_true, y_pred))
        var_y = np.var(y_true)
        exp_var = float(1 - np.var(y_true - y_pred) / var_y) if var_y > 1e-9 else 0.0

        return {
            "r2_score": round(r2, 4),
            "rmse": round(rmse, 4),
            "mae": round(mae, 4),
            "mse": round(mse, 4),
            "explained_variance": round(exp_var, 4),
        }

    @staticmethod
    def _classification_metrics(y_true, y_pred, pipeline, X_test) -> Dict[str, Any]:
        """Compute classification metrics including confusion matrix and ROC data."""
        n_classes = len(np.unique(y_true))
        avg = "binary" if n_classes == 2 else "weighted"

        cm = confusion_matrix(y_true, y_pred).tolist()

        metrics = {
            "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
            "precision": round(float(precision_score(y_true, y_pred, average=avg, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, y_pred, average=avg, zero_division=0)), 4),
            "f1_score": round(float(f1_score(y_true, y_pred, average=avg, zero_division=0)), 4),
            "confusion_matrix": cm,
        }

        # ROC AUC
        try:
            model = pipeline.named_steps.get("model")
            if hasattr(model, "predict_proba"):
                proba = pipeline.predict_proba(X_test)
                if n_classes == 2:
                    metrics["roc_auc"] = round(float(roc_auc_score(y_true, proba[:, 1])), 4)
                else:
                    metrics["roc_auc"] = round(float(roc_auc_score(y_true, proba, multi_class="ovr", average="weighted")), 4)
        except Exception as e:
            logger.warning(f"ROC AUC computation: {e}")

        return metrics

    # ── Feature Importance Extraction ─────────────────────────────────────────

    @staticmethod
    def _extract_feature_importances(pipeline, num_cols: List[str], cat_cols: List[str]) -> List[Dict[str, Any]]:
        """Extract clean, interpretable feature importance rankings."""
        importances = []
        try:
            model = pipeline.named_steps.get("model")
            preprocessor = pipeline.named_steps.get("preprocessor")

            # Get raw importances or coefficients
            if hasattr(model, "feature_importances_"):
                raw_imps = model.feature_importances_
            elif hasattr(model, "coef_"):
                raw_imps = np.abs(model.coef_.flatten())
            else:
                return []

            # Retrieve feature names from preprocessor
            feature_names = []
            try:
                feature_names = list(preprocessor.get_feature_names_out())
            except Exception:
                feature_names = [f"Feature_{i}" for i in range(len(raw_imps))]

            # Clean and aggregate feature names (e.g. num__age -> age, cat__dept_IT -> dept: IT)
            col_weights = {}
            for fname, imp in zip(feature_names, raw_imps):
                clean_name = fname
                if clean_name.startswith("num__"):
                    clean_name = clean_name[5:]
                elif clean_name.startswith("cat__"):
                    clean_name = clean_name[5:].replace("_", " = ")
                
                # Base column name for aggregation
                base_col = clean_name.split(" = ")[0] if " = " in clean_name else clean_name
                col_weights[base_col] = col_weights.get(base_col, 0.0) + float(imp)

            total_weight = sum(col_weights.values()) or 1.0
            for col, w in col_weights.items():
                importances.append({
                    "feature": col,
                    "importance": round(w / total_weight, 4),
                })

            importances.sort(key=lambda x: x["importance"], reverse=True)
        except Exception as e:
            logger.warning(f"Feature importance extraction warning: {e}")

        return importances

    # ── Clustering ────────────────────────────────────────────────────────────

    @staticmethod
    def _train_clustering(
        dataset_id: str, X: pd.DataFrame, X_cols: List[str], algorithm: str, n_clusters: int
    ) -> Dict[str, Any]:
        """Train a clustering model with standard scaling and imputation."""
        imputer = SimpleImputer(strategy="median")
        scaler = StandardScaler()
        X_clean = imputer.fit_transform(X)
        X_scaled = scaler.fit_transform(X_clean)

        if algorithm == "kmeans":
            model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = model.fit_predict(X_scaled)
        elif algorithm == "dbscan":
            model = DBSCAN(eps=0.5, min_samples=5)
            labels = model.fit_predict(X_scaled)
        elif algorithm == "agglomerative":
            model = AgglomerativeClustering(n_clusters=n_clusters)
            labels = model.fit_predict(X_scaled)
        elif algorithm == "gaussian_mixture":
            model = GaussianMixture(n_components=n_clusters, random_state=42)
            labels = model.fit_predict(X_scaled)
        else:
            raise ValueError(f"Unknown clustering algorithm: {algorithm}")

        sil_score = None
        try:
            unique_labels = np.unique(labels)
            if len(unique_labels) > 1 and -1 not in unique_labels:
                sil_score = round(float(silhouette_score(X_scaled, labels)), 4)
        except Exception:
            pass

        cluster_counts = pd.Series(labels).value_counts().sort_index().to_dict()

        return {
            "experiment_id": str(uuid.uuid4()),
            "algorithm": algorithm,
            "problem_type": "clustering",
            "feature_columns": X_cols,
            "n_clusters": int(len(np.unique(labels))),
            "metrics": {
                "silhouette_score": sil_score,
                "cluster_sizes": {str(k): int(v) for k, v in cluster_counts.items()},
            },
            "n_samples": len(labels),
        }

    # ── Compare Multiple Models ────────────────────────────────────────────────

    @staticmethod
    def compare_models(
        dataset_id: str,
        target_column: str,
        algorithms: List[str],
        test_size: float = 0.2,
    ) -> Dict[str, Any]:
        """Train multiple candidate models and benchmark their percentage accuracy."""
        results = []
        for algo in algorithms:
            try:
                result = MLService.train_model(dataset_id, target_column, algo, test_size=test_size)
                results.append({
                    "algorithm": algo,
                    "accuracy_summary": result.get("accuracy_summary"),
                    "metrics": result["metrics"],
                    "cv_mean": result["cross_validation"]["mean"],
                })
            except Exception as e:
                results.append({"algorithm": algo, "error": str(e)})

        return {
            "comparison": results,
            "target_column": target_column,
            "n_models_trained": len([r for r in results if "error" not in r]),
        }
