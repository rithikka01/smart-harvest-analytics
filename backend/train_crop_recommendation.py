"""Train a Random Forest crop-recommendation classifier from smart_harvest_dataset.xlsx.

Target: crop_type (22 classes). Features: temperature, humidity, ph, rainfall.
Metrics are computed on a stratified 20% held-out test split and stored in metadata.
"""
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score
from sklearn.model_selection import train_test_split

FEATURES = ["temperature", "humidity", "ph", "rainfall"]
TARGET = "crop_type"

data = pd.read_excel("smart_harvest_dataset.xlsx")
X = data[FEATURES].fillna(data[FEATURES].mean())
y = data[TARGET].fillna(data[TARGET].mode()[0])

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

model = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1)
model.fit(X_train, y_train)
pred = model.predict(X_test)

metrics = {
    "test_accuracy": round(float(accuracy_score(y_test, pred)), 4),
    "test_f1_macro": round(float(f1_score(y_test, pred, average="macro")), 4),
    "train_rows": int(len(X_train)),
    "test_rows": int(len(X_test)),
}
print(f"Dataset: {data.shape}, classes: {y.nunique()}")
print("Metrics:", metrics)

joblib.dump(model, "crop_recommendation_model.pkl")
joblib.dump({
    "feature_names": FEATURES,
    "target_column": TARGET,
    "model_type": "classifier",
    "algorithm": "RandomForestClassifier",
    "n_estimators": 200,
    "classes": model.classes_.tolist(),
    "dataset_rows": int(len(data)),
    "metrics": metrics,
    "feature_ranges": {f: [round(float(X[f].min()), 2), round(float(X[f].max()), 2)] for f in FEATURES},
}, "crop_recommendation_metadata.pkl")
print("Saved crop_recommendation_model.pkl + crop_recommendation_metadata.pkl")
