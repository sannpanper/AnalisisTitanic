# Titanic — Análisis Exploratorio de Datos

**Actividad P1 · Python para IA · 2º DAM**

Proyecto de **análisis exploratorio de datos (EDA)** realizado sobre el dataset **Titanic**, utilizando Python y las librerías Pandas y NumPy.

## Objetivo

El objetivo del proyecto es analizar un conjunto de datos real, realizando un proceso de **inspección, limpieza, transformación y análisis**, para obtener información sobre los pasajeros del Titanic y su supervivencia.

---

## Tareas realizadas

### T1 — Inspección de los datos

En esta primera parte se carga el dataset Titanic y se realiza una exploración inicial.

Se comprueba:

* Las primeras y últimas filas.
* El número de filas y columnas.
* Los nombres de las columnas.
* Los tipos de datos.
* Los valores nulos.
* Las estadísticas descriptivas del dataset.

---

### T2 — Limpieza de los datos

En esta fase se preparan los datos para poder trabajar con ellos correctamente.

Se realizan las siguientes tareas:

* Detección de valores nulos.
* Tratamiento de los valores ausentes en columnas como `age` y `embarked`.
* Eliminación de la columna `deck` debido a la gran cantidad de valores ausentes.
* Comprobación de registros duplicados.

Finalmente, los datos limpios se guardan en un archivo **CSV** para poder utilizarlos en las siguientes partes del proyecto.

---

### T3 — Transformación de los datos

En esta parte se crean nuevas columnas a partir de los datos existentes.

Entre las transformaciones realizadas se encuentran:

* Creación de la columna `franja_edad`, que clasifica a los pasajeros en diferentes grupos según su edad.
* Creación de la columna `familiares`, que indica el número de familiares que viajaban con cada pasajero.
* Uso de **NumPy** para realizar las transformaciones.

---

### T4 — Análisis exploratorio

Se realizan diferentes agrupaciones, filtros y cálculos estadísticos para estudiar los datos.

Se analiza principalmente:

* El porcentaje total de supervivientes.
* La supervivencia según el sexo.
* La supervivencia según la clase del billete.
* La relación entre edad y supervivencia.
* La supervivencia según la franja de edad.
* La relación entre sexo y clase.
* Los pasajeros menores de edad.

---

### T5 — Conclusiones

Por último, se interpretan los resultados obtenidos durante el análisis.

Se responden las preguntas planteadas en la actividad y se extraen varias conclusiones sobre los factores relacionados con la supervivencia de los pasajeros.

---

## Tecnologías utilizadas

* **Python**
* **Pandas** — Manipulación y análisis de datos.
* **NumPy** — Transformación y cálculo de datos.
* **Seaborn** — Obtención del dataset Titanic.
* **Jupyter Notebook** — Desarrollo y organización del proyecto.

---

## Estructura del proyecto

```text
P1-Titanic/
├── T1_inspeccion.ipynb
├── T2_1_nulos.ipynb
├── T2_2_duplicados.ipynb
├── T3_transformacion.ipynb
├── T4_analisis.ipynb
├── T5_conclusiones.ipynb
├── titanic_limpio.csv
└── README.md
```

Cada notebook corresponde a una de las fases del proyecto y el archivo `titanic_limpio.csv` permite utilizar los datos tratados en las diferentes partes.

---

## Dataset

El dataset utilizado es **Titanic**, obtenido mediante la librería Seaborn.

Contiene información sobre diferentes características de los pasajeros, como:

* Edad.
* Sexo.
* Clase del billete.
* Tarifa.
* Familiares a bordo.
* Puerto de embarque.
* Supervivencia.

---

## Autores

Proyecto realizado por:
Abraham Peña, Maria Gonzalez, Alejandro Peña, Hugo Gallardo, Angel D. Albarracín, Kenneth, Sandra Pereda.

Asignatura: Python para IA
Actividad: P1 — Análisis exploratorio de datos
