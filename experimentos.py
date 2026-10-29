import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from logtools import cargar_etiquetas, cargar_log, construir_features

# Cargar el modelo entrenado con los datos originales
modelo = joblib.load("modelo.joblib")

# E5: evaluar con un log nuevo
df = cargar_log("auth_b.log")
X = construir_features(df)
y = cargar_etiquetas("etiquetas_b.csv", X.index)

# Utilizar las mismas características que espera el modelo
X = X[modelo.feature_names_in_]

pred = modelo.predict(X)

print("\n=== E5: DATOS NUEVOS ===")
print("IPs evaluadas:", len(X))
print("Atacantes reales:", int(y.sum()))
print("Matriz de confusión:")
print(confusion_matrix(y, pred))
print(classification_report(y, pred, digits=3, zero_division=0))
print("Precision:", round(precision_score(y, pred, zero_division=0), 3))
print("Recall:", round(recall_score(y, pred, zero_division=0), 3))
print("F1:", round(f1_score(y, pred, zero_division=0), 3))

# E6: evaluar con pocos atacantes
df_poco = cargar_log("auth_poco.log")
X_poco = construir_features(df_poco)
y_poco = cargar_etiquetas("etiquetas_poco.csv", X_poco.index)

X_poco = X_poco[modelo.feature_names_in_]
pred_poco = modelo.predict(X_poco)

print("\n=== E6: POCOS ATACANTES ===")
print("IPs evaluadas:", len(X_poco))
print("Atacantes reales:", int(y_poco.sum()))
print("Matriz de confusión:")
print(confusion_matrix(y_poco, pred_poco))
print(classification_report(
    y_poco, pred_poco, digits=3, zero_division=0
))
print("Precision:", round(
    precision_score(y_poco, pred_poco, zero_division=0), 3
))
print("Recall:", round(
    recall_score(y_poco, pred_poco, zero_division=0), 3
))
print("F1:", round(
    f1_score(y_poco, pred_poco, zero_division=0), 3
))

# E6: comprobar el recall con 10 semillas diferentes

print("\n=== E6: RECALL CON 10 SEMILLAS ===")

recalls = []

for semilla in range(10):
    X_train, X_test, y_train, y_test = train_test_split(
        X_poco,
        y_poco,
        test_size=0.25,
        stratify=y_poco,
        random_state=semilla
    )

    modelo_semilla = joblib.load("modelo.joblib")

    pred_test = modelo_semilla.predict(X_test)

    recall = recall_score(
        y_test,
        pred_test,
        zero_division=0
    )

    recalls.append(recall)

    print(f"Semilla {semilla}: recall = {recall:.3f}")

print("Recalls:", [round(r, 3) for r in recalls])
print("Recall mínimo:", round(min(recalls), 3))
print("Recall máximo:", round(max(recalls), 3))
# =========================
# E7: ISOLATION FOREST
# =========================

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    precision_score,
    recall_score,
    f1_score
)
from logtools import cargar_etiquetas, cargar_log, construir_features



print("\n=== E7: ISOLATION FOREST ===")

# Cargar los datos originales del proyecto
df7 = cargar_log("auth.log")
X7 = construir_features(df7)
y7 = cargar_etiquetas("etiquetas.csv", X7.index)

# Características utilizadas por IsolationForest
cols7 = [
    "n_eventos",
    "n_fallos",
    "n_usuarios",
    "n_inv",
    "fallos_por_min",
    "max_fallos_5min",
    "ratio_fallos"
]

# Preparar las características
Z7 = StandardScaler().fit_transform(X7[cols7])

# Probar los cuatro valores solicitados por el profesor
for contaminacion in [0.05, 0.10, 0.25, 0.40]:
    iso7 = IsolationForest(
        contamination=contaminacion,
        random_state=42
    )

    # -1 significa anomalía; 1 significa normal
    pred7 = (iso7.fit_predict(Z7) == -1).astype(int)

    print(f"\n--- CONTAMINACION: {contaminacion} ---")
    print("Matriz de confusion:")
    print(confusion_matrix(y7, pred7, labels=[0, 1]))

    print(classification_report(
        y7,
        pred7,
        labels=[0, 1],
        target_names=["Legitimas (0)", "Atacantes (1)"],
        digits=3,
        zero_division=0
    ))

    print(
        f"Precision: {precision_score(y7, pred7, zero_division=0):.3f}"
    )
    print(
        f"Recall:    {recall_score(y7, pred7, zero_division=0):.3f}"
    )
    print(
        f"F1:        {f1_score(y7, pred7, zero_division=0):.3f}"
    )