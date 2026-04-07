const STORAGE_KEY = "fuelTripsV1";

const tripForm = document.getElementById("tripForm");
const predictForm = document.getElementById("predictForm");
const addTripMessage = document.getElementById("addTripMessage");
const predictionResult = document.getElementById("predictionResult");
const tripTableBody = document.getElementById("tripTableBody");
const emptyTrips = document.getElementById("emptyTrips");
const insightsList = document.getElementById("insightsList");
const clearAllBtn = document.getElementById("clearAllBtn");
const topLoader = document.getElementById("topLoader");
const topLoaderBar = document.getElementById("topLoaderBar");

const avgMileage = document.getElementById("avgMileage");
const maxMileage = document.getElementById("maxMileage");
const minMileage = document.getElementById("minMileage");
const tripCount = document.getElementById("tripCount");

const mileageChartCanvas = document.getElementById("mileageChart");
const fuelChartCanvas = document.getElementById("fuelChart");
const fuelChartNote = document.getElementById("fuelChartNote");

const addTripButton = tripForm.querySelector("button[type='submit']");
const predictButton = predictForm.querySelector("button[type='submit']");

let trips = loadTrips();
let mileageChartInstance = null;
let fuelChartInstance = null;

renderAll();
renderIcons();

// If the theme is switched via body[data-theme], refresh chart colors immediately.
new MutationObserver(() => {
  renderCharts();
}).observe(document.body, { attributes: true, attributeFilter: ["data-theme"] });

tripForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const distance = parseFloat(document.getElementById("distance").value);
  const fuel = parseFloat(document.getElementById("fuel").value);
  const dateInput = document.getElementById("date").value;

  if (!isFinite(distance) || distance <= 0 || !isFinite(fuel) || fuel <= 0) {
    addTripMessage.textContent = "Distance and fuel must be greater than 0.";
    return;
  }

  await runWithLoading(async () => {
    const mileage = distance / fuel;
    const trip = {
      date: dateInput || formatDate(new Date()),
      distance,
      fuel,
      mileage,
    };

    trips.push(trip);
    saveTrips(trips);
    renderAll();

    addTripMessage.textContent = `Trip added successfully. Mileage: ${mileage.toFixed(2)} km/L`;
    tripForm.reset();
  });
});

predictForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const futureDistance = parseFloat(document.getElementById("futureDistance").value);

  if (!isFinite(futureDistance) || futureDistance <= 0) {
    predictionResult.textContent = "Future distance must be greater than 0.";
    return;
  }

  if (trips.length === 0) {
    predictionResult.textContent = "Add at least one trip before prediction.";
    return;
  }

  await runWithLoading(async () => {
    const stats = getStats(trips);
    const fuelNeeded = futureDistance / stats.avg;
    predictionResult.textContent = `Estimated fuel needed: ${fuelNeeded.toFixed(2)} L (avg mileage ${stats.avg.toFixed(2)} km/L)`;
  });
});

clearAllBtn.addEventListener("click", () => {
  if (trips.length === 0) {
    return;
  }

  const confirmed = window.confirm("Clear all trip records? This action cannot be undone.");
  if (!confirmed) {
    return;
  }

  trips = [];
  saveTrips(trips);
  renderAll();
  addTripMessage.textContent = "All trip records cleared.";
  predictionResult.textContent = "";
});

tripTableBody.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("button[data-delete-index]");
  if (!deleteButton) {
    return;
  }

  const tripIndex = Number(deleteButton.dataset.deleteIndex);
  if (!Number.isInteger(tripIndex) || tripIndex < 0 || tripIndex >= trips.length) {
    return;
  }

  const confirmed = window.confirm("Delete this trip record?");
  if (!confirmed) {
    return;
  }

  trips.splice(tripIndex, 1);
  saveTrips(trips);
  renderAll();

  if (trips.length === 0) {
    addTripMessage.textContent = "All trips removed.";
  } else {
    addTripMessage.textContent = "Trip removed successfully.";
  }
});

function renderAll() {
  renderHistory();
  renderStats();
  renderInsights();
  renderCharts();
  clearAllBtn.disabled = trips.length === 0;
}

function renderIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

// Wrapper to show loading animation before running an action.
async function runWithLoading(taskCallback) {
  setButtonsDisabled(true);

  try {
    await animateTopLoader();
    await taskCallback();
  } finally {
    hideTopLoader();
    setButtonsDisabled(false);
  }
}

function setButtonsDisabled(disabled) {
  addTripButton.disabled = disabled;
  predictButton.disabled = disabled;
}

// Animate the top progress bar from 0% to 100% with a 1-2s delay.
function animateTopLoader() {
  return new Promise((resolve) => {
    if (!topLoader || !topLoaderBar) {
      resolve();
      return;
    }

    const duration = 1000 + Math.floor(Math.random() * 1001);
    const start = performance.now();

    topLoader.classList.add("active");
    topLoaderBar.style.width = "0%";

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      topLoaderBar.style.width = `${(eased * 100).toFixed(1)}%`;

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

function hideTopLoader() {
  if (!topLoader || !topLoaderBar) {
    return;
  }

  window.setTimeout(() => {
    topLoader.classList.remove("active");
    topLoaderBar.style.width = "0%";
  }, 140);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function renderHistory() {
  tripTableBody.innerHTML = "";

  if (trips.length === 0) {
    emptyTrips.style.display = "block";
    return;
  }

  emptyTrips.style.display = "none";

  trips.forEach((trip, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(trip.date)}</td>
      <td>${trip.distance.toFixed(2)}</td>
      <td>${trip.fuel.toFixed(2)}</td>
      <td>${trip.mileage.toFixed(2)}</td>
      <td><button class="btn danger trip-delete-btn" type="button" data-delete-index="${index}">Delete</button></td>
    `;
    tripTableBody.appendChild(row);
  });
}

function renderStats() {
  tripCount.textContent = String(trips.length);

  if (trips.length === 0) {
    avgMileage.textContent = "-";
    maxMileage.textContent = "-";
    minMileage.textContent = "-";
    return;
  }

  const stats = getStats(trips);
  avgMileage.textContent = `${stats.avg.toFixed(2)} km/L`;
  maxMileage.textContent = `${stats.max.toFixed(2)} km/L`;
  minMileage.textContent = `${stats.min.toFixed(2)} km/L`;
}

function renderInsights() {
  insightsList.innerHTML = "";

  const insightItems = getInsightsDetailed(trips);
  insightItems.forEach((item) => {
    const li = document.createElement("li");
    li.className = "insight-item";
    li.innerHTML = `
      <p>${escapeHtml(item.message)}</p>
      <span class="insight-badge ${item.tone}">${escapeHtml(item.label)}</span>
    `;
    insightsList.appendChild(li);
  });
}

function renderCharts() {
  if (typeof Chart === "undefined") {
    return;
  }

  const themeColors = getChartThemeColors();

  const mileageSeries = buildChartSeries(trips, "mileage");
  const fuelSeries = buildFuelChartSeries(trips);

  if (mileageChartInstance) {
    mileageChartInstance.destroy();
  }
  if (fuelChartInstance) {
    fuelChartInstance.destroy();
  }

  mileageChartInstance = new Chart(mileageChartCanvas, {
    type: "line",
    data: {
      labels: mileageSeries.labels,
      datasets: [
        {
          label: "Mileage (km/L)",
          data: mileageSeries.values,
          borderColor: themeColors.line,
          backgroundColor: themeColors.lineFill,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5,
        },
      ],
    },
    options: getChartOptions(themeColors),
  });
  fuelChartInstance = new Chart(fuelChartCanvas, {
    type: "bar",
    data: {
      labels: fuelSeries.labels,
      datasets: [
        {
          label: "Fuel (L)",
          data: fuelSeries.values,
          backgroundColor: themeColors.bar,
          borderColor: themeColors.barBorder,
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: fuelSeries.barPercentage,
          categoryPercentage: fuelSeries.categoryPercentage,
          maxBarThickness: fuelSeries.maxBarThickness,
        },
      ],
    },
    options: getChartOptions(themeColors),
  });

  if (fuelChartNote) {
    fuelChartNote.textContent =
      trips.length === 1 ? "Add more trips to see a clearer fuel trend." : "";
  }
}

function buildChartSeries(data, valueKey) {
  if (data.length === 1) {
    return {
      labels: ["Start", "Trip 1"],
      values: [0, Number(data[0][valueKey])],
    };
  }

  return {
    labels: data.map((trip, index) => `Trip ${index + 1}`),
    values: data.map((trip) => Number(trip[valueKey])),
  };
}

function buildFuelChartSeries(data) {
  const count = data.length;
  const barPercentage = Math.max(0.48, 0.98 - (count - 1) * 0.12);
  const categoryPercentage = Math.max(0.58, 0.92 - (count - 1) * 0.08);
  const maxBarThickness = Math.max(24, 76 - (count - 1) * 10);

  return {
    labels: data.map((trip, index) => `Trip ${index + 1}`),
    values: data.map((trip) => Number(trip.fuel)),
    barPercentage,
    categoryPercentage,
    maxBarThickness,
  };
}

function getChartOptions(themeColors = getChartThemeColors()) {
  const isMobile = window.matchMedia("(max-width: 820px)").matches;

  return {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: isMobile ? 1.7 : 2.2,
    layout: {
      padding: {
        left: 16,
        right: 16,
        top: 6,
        bottom: 4,
      },
    },
    scales: {
      x: {
        offset: true,
        ticks: {
          color: themeColors.label,
        },
        grid: {
          color: themeColors.grid,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: themeColors.label,
        },
        grid: {
          color: themeColors.grid,
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: themeColors.legend,
        },
      },
    },
  };
}

function getChartThemeColors() {
  return {
    line: getCssVar("--chart-line", "#6366f1"),
    lineFill: getCssVar("--chart-line-fill", "rgba(99, 102, 241, 0.18)"),
    bar: getCssVar("--chart-bar", "rgba(139, 92, 246, 0.62)"),
    barBorder: getCssVar("--chart-bar-border", "#8b5cf6"),
    grid: getCssVar("--chart-grid", "rgba(255, 255, 255, 0.08)"),
    label: getCssVar("--chart-label", "#94a3b8"),
    legend: getCssVar("--chart-legend", "#e2e8f0"),
  };
}

function getCssVar(name, fallback) {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function getStats(data) {
  const mileages = data.map((trip) => trip.mileage);
  const sum = mileages.reduce((total, value) => total + value, 0);
  const avg = sum / mileages.length;
  const max = Math.max(...mileages);
  const min = Math.min(...mileages);
  return { avg, max, min };
}

function getInsightsDetailed(data) {
  if (data.length === 0) {
    return [
      {
        message: "No insights yet. Add a few trips and we'll show useful patterns.",
        label: "Ready",
        tone: "info",
      },
    ];
  }

  if (data.length === 1) {
    return [
      {
        message: "One trip logged. Add a few more trips to unlock trend analysis.",
        label: "Warmup",
        tone: "info",
      },
    ];
  }

  const insights = [];
  const mileages = data.map((trip) => trip.mileage);
  const fuels = data.map((trip) => trip.fuel);

  const bestIndex = mileages.indexOf(Math.max(...mileages));
  const worstIndex = mileages.indexOf(Math.min(...mileages));

  insights.push({
    message: `Best trip performance: Trip ${bestIndex + 1} reached ${mileages[bestIndex].toFixed(2)} km/L.`,
    label: "Best",
    tone: "good",
  });

  insights.push({
    message: `Lowest efficiency: Trip ${worstIndex + 1} recorded ${mileages[worstIndex].toFixed(2)} km/L.`,
    label: "Attention",
    tone: "warn",
  });

  const split = Math.max(1, Math.floor(mileages.length / 2));
  const firstAvg = average(mileages.slice(0, split));
  const secondAvg = average(mileages.slice(split));
  const mileageChangePct = ((secondAvg - firstAvg) / firstAvg) * 100;

  if (mileageChangePct > 1) {
    insights.push({
      message: `Mileage improving by ${mileageChangePct.toFixed(2)}% in recent trips.`,
      label: "Improving",
      tone: "good",
    });
  } else if (mileageChangePct < -1) {
    insights.push({
      message: `Mileage dropped by ${Math.abs(mileageChangePct).toFixed(2)}% recently.`,
      label: "Decreasing",
      tone: "bad",
    });
  } else {
    insights.push({
      message: "Mileage remains stable across recent trips.",
      label: "Stable",
      tone: "info",
    });
  }

  const recentFuels = fuels.slice(-3);
  if (recentFuels.length >= 2) {
    if (recentFuels[recentFuels.length - 1] > recentFuels[0]) {
      insights.push({
        message: "Fuel consumption increased in your latest trips.",
        label: "Fuel Up",
        tone: "warn",
      });
    } else if (recentFuels[recentFuels.length - 1] < recentFuels[0]) {
      insights.push({
        message: "Fuel consumption reduced in your latest trips.",
        label: "Efficient",
        tone: "good",
      });
    } else {
      insights.push({
        message: "Fuel consumption trend is flat over recent trips.",
        label: "Flat",
        tone: "info",
      });
    }
  }

  return insights;
}

function average(values) {
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function loadTrips() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((trip) => isValidTrip(trip))
      .map((trip) => ({
        date: String(trip.date),
        distance: Number(trip.distance),
        fuel: Number(trip.fuel),
        mileage: Number(trip.mileage),
      }));
  } catch {
    return [];
  }
}

function saveTrips(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function isValidTrip(trip) {
  if (!trip || typeof trip !== "object") {
    return false;
  }

  const distance = Number(trip.distance);
  const fuel = Number(trip.fuel);
  const mileage = Number(trip.mileage);

  return (
    typeof trip.date === "string" &&
    isFinite(distance) &&
    distance > 0 &&
    isFinite(fuel) &&
    fuel > 0 &&
    isFinite(mileage) &&
    mileage > 0
  );
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
