# Fuel Consumption Tracker + Prediction System

A browser-based mini project to track trip fuel usage, calculate mileage automatically, analyze efficiency trends, and predict fuel needed for future trips.

## Features

- Add and manage trip records from a website UI
- Automatic mileage calculation: `mileage = distance / fuel`
- Live statistics:
  - Average mileage
  - Maximum mileage
  - Minimum mileage
- Performance insights:
  - Best and worst trips
  - Mileage improvement or drop trend
  - Recent fuel usage trend
- Prediction module:
  - Predict fuel needed for a future distance
- Data persistence in browser local storage

## Project Files

- `index.html`: Main web page
- `styles.css`: UI styling and responsive layout
- `app.js`: Tracker logic, analytics, and prediction
- `fuel_tracker.py`: Optional console version

## Example
- Distance = 100 km
- Fuel = 5 L
- Mileage = 20 km/L

If average mileage is `20 km/L` and future distance is `200 km`.
