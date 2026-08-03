"""
AI Data Analyst - Data Cleaning Service
==========================================
Provides all data cleaning operations:
- Handle missing values (drop, fill mean/median/mode/constant/interpolation/ffill/bfill)
- Remove duplicate rows (all or subset)
- Rename / drop columns
- Convert data types (numeric, integer, float, string, category, datetime, boolean)
- Outlier detection and handling (IQR, Z-Score -> remove, cap, mean, median)
- Normalization and standardization (MinMax, Z-Score, Robust)
- Encoding (One-Hot, Label, Ordinal)
- Handle skewness (log, sqrt, Box-Cox, Yeo-Johnson transforms)
- Remove constant features (zero-variance columns)
"""

import os
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.preprocessing import (
    MinMaxScaler, StandardScaler, RobustScaler,
    LabelEncoder, OrdinalEncoder, PowerTransformer
)
from typing import Dict, Any, List, Optional

from app.config import settings
from app.services.data_service import DataService
from app.utils.logger import setup_logger

logger = setup_logger(__name__)


class CleaningService:
    """Performs all data cleaning operations on in-memory DataFrames."""

    # ── Missing Value Handling ─────────────────────────────────────────────────

    @staticmethod
    def handle_missing_values(
        dataset_id: str,
        strategy: str,
        columns: Optional[List[str]] = None,
        fill_value: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Handle missing values in the dataset.
        
        Args:
            dataset_id: Dataset identifier
            strategy: 'drop_rows' | 'drop_cols' | 'fill_mean' | 'fill_median' |
                      'fill_mode' | 'fill_constant' | 'interpolate' | 'ffill' | 'bfill'
            columns: Specific columns to apply the operation (None = all)
            fill_value: Value to use when strategy is 'fill_constant'
        
        Returns:
            Operation result with before/after counts
        """
        df = DataService.get_dataframe(dataset_id).copy()
        target_cols = [c for c in (columns or list(df.columns)) if c in df.columns]

        if not target_cols:
            raise ValueError("No valid columns specified for missing value handling")

        before_missing = int(df[target_cols].isnull().sum().sum())
        before_rows = len(df)

        if strategy == "drop_rows":
            df = df.dropna(subset=target_cols)

        elif strategy == "drop_cols":
            df = df.drop(columns=target_cols)

        elif strategy == "fill_mean":
            for col in target_cols:
                if pd.api.types.is_numeric_dtype(df[col]):
                    mean_val = df[col].mean()
                    if not pd.isna(mean_val):
                        df[col] = df[col].fillna(mean_val)

        elif strategy == "fill_median":
            for col in target_cols:
                if pd.api.types.is_numeric_dtype(df[col]):
                    median_val = df[col].median()
                    if not pd.isna(median_val):
                        df[col] = df[col].fillna(median_val)

        elif strategy == "fill_mode":
            for col in target_cols:
                mode_val = df[col].mode()
                if not mode_val.empty:
                    df[col] = df[col].fillna(mode_val.iloc[0])

        elif strategy == "fill_constant":
            for col in target_cols:
                df[col] = df[col].fillna(fill_value)

        elif strategy == "interpolate":
            for col in target_cols:
                if pd.api.types.is_numeric_dtype(df[col]):
                    df[col] = df[col].interpolate(method="linear", limit_direction="both")

        elif strategy == "ffill":
            df[target_cols] = df[target_cols].ffill()

        elif strategy == "bfill":
            df[target_cols] = df[target_cols].bfill()

        else:
            raise ValueError(f"Unknown missing value strategy: {strategy}")

        remaining_cols = [c for c in target_cols if c in df.columns]
        after_missing = int(df[remaining_cols].isnull().sum().sum()) if remaining_cols else 0
        after_rows = len(df)

        DataService.update_dataframe(dataset_id, df)
        logger.info(f"Missing values handled ({strategy}) for dataset {dataset_id}")

        return {
            "operation": "handle_missing_values",
            "strategy": strategy,
            "columns_affected": target_cols,
            "before_missing": before_missing,
            "after_missing": after_missing,
            "rows_removed": before_rows - after_rows,
            "shape": list(df.shape),
        }

    # ── Duplicate Rows ────────────────────────────────────────────────────────

    @staticmethod
    def remove_duplicates(dataset_id: str, subset: Optional[List[str]] = None) -> Dict[str, Any]:
        """Remove duplicate rows from the dataset."""
        df = DataService.get_dataframe(dataset_id).copy()
        if subset:
            valid_subset = [c for c in subset if c in df.columns]
            subset = valid_subset if valid_subset else None

        before = len(df)
        df = df.drop_duplicates(subset=subset)
        after = len(df)
        DataService.update_dataframe(dataset_id, df)
        return {
            "operation": "remove_duplicates",
            "rows_before": before,
            "rows_after": after,
            "rows_removed": before - after,
            "shape": list(df.shape),
        }

    # ── Column Operations ─────────────────────────────────────────────────────

    @staticmethod
    def rename_columns(dataset_id: str, rename_map: Dict[str, str]) -> Dict[str, Any]:
        """Rename specified columns."""
        df = DataService.get_dataframe(dataset_id).copy()
        valid_map = {k: v for k, v in rename_map.items() if k in df.columns and str(v).strip()}
        if not valid_map:
            raise ValueError("No valid columns to rename")

        df = df.rename(columns=valid_map)
        DataService.update_dataframe(dataset_id, df)
        return {
            "operation": "rename_columns",
            "renamed": valid_map,
            "shape": list(df.shape),
        }

    @staticmethod
    def drop_columns(dataset_id: str, columns: List[str]) -> Dict[str, Any]:
        """Drop specified columns."""
        df = DataService.get_dataframe(dataset_id).copy()
        valid_cols = [c for c in columns if c in df.columns]
        if not valid_cols:
            raise ValueError("None of the specified columns exist in the dataset")

        df = df.drop(columns=valid_cols)
        DataService.update_dataframe(dataset_id, df)
        return {
            "operation": "drop_columns",
            "dropped": valid_cols,
            "shape": list(df.shape),
        }

    @staticmethod
    def convert_dtype(dataset_id: str, column: str, target_dtype: str) -> Dict[str, Any]:
        """Convert a column to a different data type."""
        df = DataService.get_dataframe(dataset_id).copy()
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

        original_dtype = str(df[column].dtype)
        try:
            if target_dtype == "datetime":
                df[column] = pd.to_datetime(df[column], errors="coerce")
            elif target_dtype == "numeric":
                df[column] = pd.to_numeric(df[column], errors="coerce")
            elif target_dtype == "string":
                df[column] = df[column].astype(str)
            elif target_dtype == "category":
                df[column] = df[column].astype("category")
            elif target_dtype == "integer":
                num_series = pd.to_numeric(df[column], errors="coerce")
                df[column] = num_series.round().astype("Int64")
            elif target_dtype == "float":
                df[column] = pd.to_numeric(df[column], errors="coerce").astype(float)
            elif target_dtype == "boolean":
                bool_map = {
                    "True": True, "False": False, "true": True, "false": False,
                    "1": True, "0": False, 1: True, 0: False, True: True, False: False,
                    "yes": True, "no": False, "Yes": True, "No": False, "Y": True, "N": False, "t": True, "f": False
                }
                df[column] = df[column].map(bool_map)
            else:
                raise ValueError(f"Unknown target dtype: {target_dtype}")
        except Exception as e:
            raise ValueError(f"Cannot convert '{column}' to {target_dtype}: {e}")

        DataService.update_dataframe(dataset_id, df)
        return {
            "operation": "convert_dtype",
            "column": column,
            "from_dtype": original_dtype,
            "to_dtype": target_dtype,
            "shape": list(df.shape),
        }

    # ── Outlier Handling ──────────────────────────────────────────────────────

    @staticmethod
    def handle_outliers(
        dataset_id: str,
        column: str,
        method: str = "iqr",
        strategy: str = "remove",
        threshold: float = 1.5,
    ) -> Dict[str, Any]:
        """
        Detect and handle outliers.
        
        Args:
            method: 'iqr' | 'zscore'
            strategy: 'remove' | 'cap' | 'replace_mean' | 'replace_median'
            threshold: IQR multiplier (default 1.5) or Z-score threshold (default 3)
        """
        df = DataService.get_dataframe(dataset_id).copy()
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Column '{column}' must be numeric to handle outliers")

        series = df[column]
        before_rows = len(df)

        # Detect outlier mask & define boundaries
        if method == "iqr":
            q1 = float(series.quantile(0.25))
            q3 = float(series.quantile(0.75))
            iqr = q3 - q1
            lower = q1 - threshold * iqr
            upper = q3 + threshold * iqr
            outlier_mask = (series < lower) | (series > upper)
        elif method == "zscore":
            mean = float(series.mean())
            std = float(series.std()) if float(series.std()) != 0 else 1.0
            lower = mean - threshold * std
            upper = mean + threshold * std
            valid_series = series.dropna()
            if len(valid_series) > 1 and series.std() > 0:
                z_scores = np.abs(stats.zscore(valid_series))
                outlier_mask = pd.Series(False, index=series.index)
                outlier_mask.loc[valid_series.index] = z_scores > threshold
            else:
                outlier_mask = pd.Series(False, index=series.index)
        else:
            raise ValueError(f"Unknown outlier method: {method}")

        n_outliers = int(outlier_mask.sum())

        # Apply strategy
        if strategy == "remove":
            df = df[~outlier_mask]
        elif strategy == "cap":
            if not pd.api.types.is_float_dtype(df[column]):
                df[column] = df[column].astype(float)
            df.loc[series < lower, column] = float(lower)
            df.loc[series > upper, column] = float(upper)
        elif strategy == "replace_mean":
            if not pd.api.types.is_float_dtype(df[column]):
                df[column] = df[column].astype(float)
            df.loc[outlier_mask, column] = float(series.mean())
        elif strategy == "replace_median":
            if not pd.api.types.is_float_dtype(df[column]):
                df[column] = df[column].astype(float)
            df.loc[outlier_mask, column] = float(series.median())
        else:
            raise ValueError(f"Unknown outlier strategy: {strategy}")

        DataService.update_dataframe(dataset_id, df)
        return {
            "operation": "handle_outliers",
            "column": column,
            "method": method,
            "strategy": strategy,
            "outliers_found": n_outliers,
            "rows_before": before_rows,
            "rows_after": len(df),
            "shape": list(df.shape),
        }

    # ── Normalization & Standardization ───────────────────────────────────────

    @staticmethod
    def normalize(
        dataset_id: str,
        columns: Optional[List[str]] = None,
        method: str = "minmax",
    ) -> Dict[str, Any]:
        """
        Normalize/standardize numeric columns.
        
        Args:
            method: 'minmax' (0-1) | 'zscore' (StandardScaler) | 'robust' (RobustScaler)
        """
        df = DataService.get_dataframe(dataset_id).copy()
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        target_cols = [c for c in (columns or numeric_cols) if c in numeric_cols]

        if not target_cols:
            raise ValueError("No numeric columns to normalize")

        if method == "minmax":
            scaler = MinMaxScaler()
        elif method == "zscore":
            scaler = StandardScaler()
        elif method == "robust":
            scaler = RobustScaler()
        else:
            raise ValueError(f"Unknown normalization method: {method}")

        for col in target_cols:
            if not pd.api.types.is_float_dtype(df[col]):
                df[col] = df[col].astype(float)

        df[target_cols] = scaler.fit_transform(df[target_cols])
        DataService.update_dataframe(dataset_id, df)

        return {
            "operation": "normalize",
            "method": method,
            "columns_normalized": target_cols,
            "shape": list(df.shape),
        }

    # ── Encoding ──────────────────────────────────────────────────────────────

    @staticmethod
    def encode_column(
        dataset_id: str,
        column: str,
        method: str = "label",
        categories: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Encode a categorical column.
        
        Args:
            method: 'label' | 'onehot' | 'ordinal'
            categories: Ordered categories list for ordinal encoding
        """
        df = DataService.get_dataframe(dataset_id).copy()
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

        # Convert to string/category first to avoid type issues
        df[column] = df[column].astype(str)

        if method == "label":
            le = LabelEncoder()
            # Retain NaN positions
            non_null = df[column].dropna()
            df.loc[non_null.index, column] = le.fit_transform(non_null)
            mapping = {str(cls): int(idx) for idx, cls in enumerate(le.classes_)}
            df[column] = pd.to_numeric(df[column], errors="coerce")

        elif method == "onehot":
            # Limit number of categories to prevent explosive column creation
            n_unique = df[column].nunique()
            if n_unique > 50:
                raise ValueError(f"Column '{column}' has {n_unique} unique values. One-hot encoding is limited to 50 categories to prevent memory exhaustion.")
            dummies = pd.get_dummies(df[column], prefix=column, drop_first=False, dtype=int)
            df = pd.concat([df.drop(columns=[column]), dummies], axis=1)
            mapping = {col: f"dummy for {column}" for col in dummies.columns}

        elif method == "ordinal":
            if not categories:
                # Infer order alphabetically if not provided
                categories = sorted(df[column].dropna().unique().tolist())
            oe = OrdinalEncoder(categories=[categories], handle_unknown="use_encoded_value", unknown_value=-1)
            non_null = df[[column]].dropna()
            df.loc[non_null.index, column] = oe.fit_transform(non_null)
            mapping = {cat: idx for idx, cat in enumerate(categories)}
            df[column] = pd.to_numeric(df[column], errors="coerce")

        else:
            raise ValueError(f"Unknown encoding method: {method}")

        DataService.update_dataframe(dataset_id, df)
        return {
            "operation": "encode",
            "column": column,
            "method": method,
            "mapping": mapping,
            "shape": list(df.shape),
        }

    # ── Handle Skewness ────────────────────────────────────────────────────────

    @staticmethod
    def handle_skewness(
        dataset_id: str,
        column: str,
        method: str = "log",
    ) -> Dict[str, Any]:
        """
        Apply transformations to reduce skewness.
        
        Args:
            method: 'log' | 'sqrt' | 'boxcox' | 'yeo_johnson'
        """
        df = DataService.get_dataframe(dataset_id).copy()
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found")

        if not pd.api.types.is_numeric_dtype(df[column]):
            raise ValueError(f"Column '{column}' must be numeric to handle skewness")

        if not pd.api.types.is_float_dtype(df[column]):
            df[column] = df[column].astype(float)

        series = df[column].dropna()
        if len(series) == 0:
            raise ValueError(f"Column '{column}' has no valid numeric data")

        before_skew = float(series.skew())

        if method == "log":
            if (series <= 0).any():
                # Shift to strictly positive before log1p
                shift = abs(float(series.min())) + 1.0
                df[column] = np.log1p(df[column] + shift)
            else:
                df[column] = np.log(df[column])

        elif method == "sqrt":
            df[column] = np.sqrt(np.abs(df[column]))

        elif method == "boxcox":
            positive_series = series[series > 0]
            if len(positive_series) < len(series):
                raise ValueError("Box-Cox requires strictly positive values")
            transformed, _ = stats.boxcox(positive_series)
            df.loc[positive_series.index, column] = transformed

        elif method == "yeo_johnson":
            pt = PowerTransformer(method="yeo-johnson")
            non_null_idx = df[column].dropna().index
            df.loc[non_null_idx, column] = pt.fit_transform(df.loc[non_null_idx, [column]]).flatten()

        else:
            raise ValueError(f"Unknown skewness method: {method}")

        after_skew = float(df[column].dropna().skew()) if len(df[column].dropna()) > 0 else 0.0
        DataService.update_dataframe(dataset_id, df)

        return {
            "operation": "handle_skewness",
            "column": column,
            "method": method,
            "before_skewness": round(before_skew, 4),
            "after_skewness": round(after_skew, 4),
            "improvement": round(abs(before_skew) - abs(after_skew), 4),
            "shape": list(df.shape),
        }

    # ── Remove Constant Features ──────────────────────────────────────────────

    @staticmethod
    def remove_constant_features(dataset_id: str) -> Dict[str, Any]:
        """Remove columns with only one unique value (no information)."""
        df = DataService.get_dataframe(dataset_id).copy()
        constant_cols = [col for col in df.columns if df[col].nunique(dropna=False) <= 1]
        if constant_cols:
            df = df.drop(columns=constant_cols)
            DataService.update_dataframe(dataset_id, df)

        return {
            "operation": "remove_constant_features",
            "removed_columns": constant_cols,
            "shape": list(df.shape),
        }

    # ── Export Cleaned Dataset ────────────────────────────────────────────────

    @staticmethod
    def export_cleaned(dataset_id: str, format: str = "csv") -> str:
        """Save cleaned dataset to disk and return file path."""
        df = DataService.get_dataframe(dataset_id)
        os.makedirs(settings.REPORTS_DIR, exist_ok=True)
        filename = f"{dataset_id}_cleaned.{format}"
        file_path = os.path.join(settings.REPORTS_DIR, filename)

        if format == "csv":
            df.to_csv(file_path, index=False)
        elif format == "xlsx":
            df.to_excel(file_path, index=False, engine="openpyxl")
        elif format == "json":
            df.to_json(file_path, orient="records", date_format="iso")
        else:
            raise ValueError(f"Unknown export format: {format}")

        return file_path
