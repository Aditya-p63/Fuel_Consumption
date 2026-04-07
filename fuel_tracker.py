from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import numpy as np


DATA_FILE = Path("trips.csv")
DATE_FMT = "%Y-%m-%d"


@dataclass
class TripRecord:
    date: str
    distance_km: float
    fuel_l: float
    mileage_kmpl: float


class FuelConsumptionTracker:
    def __init__(self, csv_path: Path = DATA_FILE) -> None:
        self.csv_path = csv_path
        self.trips: List[TripRecord] = []
        self._load_trips()

    def _load_trips(self) -> None:
        if not self.csv_path.exists():
            return

        with self.csv_path.open("r", newline="", encoding="utf-8") as file:
            reader = csv.DictReader(file)
            for row in reader:
                try:
                    trip = TripRecord(
                        date=row["date"],
                        distance_km=float(row["distance_km"]),
                        fuel_l=float(row["fuel_l"]),
                        mileage_kmpl=float(row["mileage_kmpl"]),
                    )
                    self.trips.append(trip)
                except (KeyError, ValueError):
                    continue

    def _save_trips(self) -> None:
        with self.csv_path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.DictWriter(
                file,
                fieldnames=["date", "distance_km", "fuel_l", "mileage_kmpl"],
            )
            writer.writeheader()
            for trip in self.trips:
                writer.writerow(
                    {
                        "date": trip.date,
                        "distance_km": f"{trip.distance_km:.3f}",
                        "fuel_l": f"{trip.fuel_l:.3f}",
                        "mileage_kmpl": f"{trip.mileage_kmpl:.3f}",
                    }
                )

    def add_trip(self, distance_km: float, fuel_l: float, date: Optional[str] = None) -> TripRecord:
        if distance_km <= 0:
            raise ValueError("Distance must be greater than 0.")
        if fuel_l <= 0:
            raise ValueError("Fuel consumed must be greater than 0.")

        trip_date = date or datetime.now().strftime(DATE_FMT)
        datetime.strptime(trip_date, DATE_FMT)

        mileage = distance_km / fuel_l
        trip = TripRecord(
            date=trip_date,
            distance_km=distance_km,
            fuel_l=fuel_l,
            mileage_kmpl=mileage,
        )

        self.trips.append(trip)
        self._save_trips()
        return trip

    def get_statistics(self) -> dict:
        if not self.trips:
            return {}

        mileage_values = np.array([trip.mileage_kmpl for trip in self.trips], dtype=float)
        return {
            "avg_mileage": float(np.mean(mileage_values)),
            "max_mileage": float(np.max(mileage_values)),
            "min_mileage": float(np.min(mileage_values)),
            "std_dev": float(np.std(mileage_values)),
        }

    def analyze_performance(self) -> List[str]:
        if len(self.trips) < 2:
            return ["Not enough trips to analyze trends yet."]

        insights: List[str] = []
        mileages = np.array([trip.mileage_kmpl for trip in self.trips], dtype=float)

        best_idx = int(np.argmax(mileages))
        worst_idx = int(np.argmin(mileages))
        insights.append(
            f"Best efficiency on Trip {best_idx + 1} ({self.trips[best_idx].date}): {mileages[best_idx]:.2f} km/L"
        )
        insights.append(
            f"Worst efficiency on Trip {worst_idx + 1} ({self.trips[worst_idx].date}): {mileages[worst_idx]:.2f} km/L"
        )

        split = max(1, len(mileages) // 2)
        earlier_avg = float(np.mean(mileages[:split]))
        recent_avg = float(np.mean(mileages[split:]))

        if earlier_avg > 0:
            change_pct = ((recent_avg - earlier_avg) / earlier_avg) * 100
            if change_pct > 1:
                insights.append(f"Mileage improved by {change_pct:.2f}% in recent trips.")
            elif change_pct < -1:
                insights.append(f"Mileage dropped by {abs(change_pct):.2f}% in recent trips.")
            else:
                insights.append("Mileage is mostly stable across recent trips.")

        recent_fuel = np.array([trip.fuel_l for trip in self.trips[-3:]], dtype=float)
        if len(recent_fuel) >= 2:
            if recent_fuel[-1] > recent_fuel[0]:
                insights.append("Fuel usage trend: increasing over the last few trips.")
            elif recent_fuel[-1] < recent_fuel[0]:
                insights.append("Fuel usage trend: decreasing over the last few trips.")
            else:
                insights.append("Fuel usage trend: flat over the last few trips.")

        return insights

    def predict_fuel_for_distance(self, future_distance_km: float) -> float:
        if future_distance_km <= 0:
            raise ValueError("Future distance must be greater than 0.")
        if not self.trips:
            raise ValueError("No trip data available for prediction.")

        avg_mileage = float(np.mean(np.array([trip.mileage_kmpl for trip in self.trips], dtype=float)))
        if avg_mileage <= 0:
            raise ValueError("Average mileage is invalid.")

        return future_distance_km / avg_mileage

    def display_trip_history(self) -> None:
        if not self.trips:
            print("\nNo trip records available yet.")
            return

        print("\nTrip History")
        print("-" * 72)
        print(f"{'Trip':<6}{'Date':<12}{'Distance(km)':<16}{'Fuel(L)':<12}{'Mileage(km/L)':<14}")
        print("-" * 72)
        for idx, trip in enumerate(self.trips, start=1):
            print(
                f"{idx:<6}{trip.date:<12}{trip.distance_km:<16.2f}{trip.fuel_l:<12.2f}{trip.mileage_kmpl:<14.2f}"
            )

    def display_statistics(self) -> None:
        stats = self.get_statistics()
        if not stats:
            print("\nNo data available for statistics.")
            return

        print("\nStatistics")
        print("-" * 32)
        print(f"Average mileage : {stats['avg_mileage']:.2f} km/L")
        print(f"Maximum mileage : {stats['max_mileage']:.2f} km/L")
        print(f"Minimum mileage : {stats['min_mileage']:.2f} km/L")
        print(f"Std deviation   : {stats['std_dev']:.2f}")

    def display_insights(self) -> None:
        print("\nPerformance Insights")
        print("-" * 32)
        for line in self.analyze_performance():
            print(f"- {line}")


def prompt_float(label: str) -> float:
    while True:
        raw = input(label).strip()
        try:
            value = float(raw)
            return value
        except ValueError:
            print("Please enter a valid number.")


def prompt_date_optional() -> Optional[str]:
    raw = input(f"Date (YYYY-MM-DD, press Enter for today): ").strip()
    if not raw:
        return None

    try:
        datetime.strptime(raw, DATE_FMT)
        return raw
    except ValueError:
        print("Invalid date format. Using today's date.")
        return None


def show_menu() -> None:
    print("\nFuel Consumption Tracker + Prediction")
    print("1. Add new trip")
    print("2. View trip history")
    print("3. View statistics")
    print("4. View performance insights")
    print("5. Predict fuel needed for future trip")
    print("0. Exit")


def main() -> None:
    tracker = FuelConsumptionTracker()

    while True:
        show_menu()
        choice = input("Choose an option: ").strip()

        try:
            if choice == "1":
                distance = prompt_float("Distance traveled (km): ")
                fuel = prompt_float("Fuel consumed (L): ")
                date = prompt_date_optional()
                trip = tracker.add_trip(distance, fuel, date)
                print(f"Mileage calculated: {trip.mileage_kmpl:.2f} km/L")

            elif choice == "2":
                tracker.display_trip_history()

            elif choice == "3":
                tracker.display_statistics()

            elif choice == "4":
                tracker.display_insights()

            elif choice == "5":
                future_distance = prompt_float("Enter future distance (km): ")
                fuel_needed = tracker.predict_fuel_for_distance(future_distance)
                print(
                    f"Predicted fuel needed for {future_distance:.2f} km: {fuel_needed:.2f} L"
                )

            elif choice == "0":
                print("Goodbye!")
                break

            else:
                print("Invalid option. Choose from 0 to 5.")
        except ValueError as error:
            print(f"Error: {error}")


if __name__ == "__main__":
    main()
