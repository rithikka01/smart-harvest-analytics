import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.metrics import mean_squared_error, r2_score

print("Loading dataset...")
data = pd.read_excel("smart_harvest_dataset.xlsx")

print(f"Dataset shape: {data.shape}")
print(f"Columns: {data.columns.tolist()}")

# Handle missing values
num_cols = data.select_dtypes(include=np.number).columns
data[num_cols] = data[num_cols].fillna(data[num_cols].mean())

cat_cols = data.select_dtypes(exclude=np.number).columns
for col in cat_cols:
    data[col] = data[col].fillna(data[col].mode()[0])

# Encode categorical variables
label_encoders = {}
for col in cat_cols:
    encoder = LabelEncoder()
    data[col] = encoder.fit_transform(data[col])
    label_encoders[col] = encoder

# Save encoders for later use
joblib.dump(label_encoders, "label_encoders.pkl")

# Use water_usage_efficiency as target (can be adapted based on your needs)
target_column = "water_usage_efficiency"

X = data.drop(columns=[target_column])
y = data[target_column]

print(f"\nFeatures shape: {X.shape}")
print(f"Target shape: {y.shape}")
print(f"Target column: {target_column}")
print(f"Target range: {y.min()} to {y.max()}")

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

print(f"\nTraining set size: {X_train.shape[0]}")
print(f"Test set size: {X_test.shape[0]}")

# Train model
if y.nunique() <= 10:
    print("\nTraining Random Forest Classifier...")
    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    print(f"\nAccuracy: {accuracy_score(y_test, y_pred)}")
    print("\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))
    
else:
    print("\nTraining Random Forest Regressor...")
    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1
    )
    
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    print(f"\nRMSE: {rmse}")
    print(f"R² Score: {r2}")

# Feature importance
feature_importance = pd.DataFrame({
    "Feature": X.columns,
    "Importance": model.feature_importances_
}).sort_values(by="Importance", ascending=False)

print("\nTop 10 Feature Importance:")
print(feature_importance.head(10))

# Save model and metadata
joblib.dump(model, "crop_yield_model.pkl")
joblib.dump({
    'feature_names': X.columns.tolist(),
    'target_column': target_column,
    'model_type': 'classifier' if y.nunique() <= 10 else 'regressor'
}, "model_metadata.pkl")

print("\n✅ Model trained and saved successfully!")
print("   - crop_yield_model.pkl")
print("   - model_metadata.pkl")
print("   - label_encoders.pkl")
