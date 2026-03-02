# Cycle & Period Calculation Logic

This document describes the algorithms used in `src/services/statsService.ts` to calculate menstrual cycle statistics and predict future dates.

## 1. Period Clustering (grouping days)

Raw data consists of individual "period" events. To make sense of this data, we first group these individual days into **clusters** (distinct periods).

**Algorithm:**
1.  Sort all period events by date (ascending).
2.  Iterate through the sorted events.
3.  For each event, compare its date to the previous event's date:
    *   **Gap ≤ 7 days:** The event is added to the *current* cluster. This handles cases where a user might forget to log a day or has light spotting near their period.
    *   **Gap > 7 days:** The current cluster is "closed", and a *new* cluster begins. This gap threshold defines the separation between two distinct menstrual cycles.

**Example:**
*   **Logs:** Jan 1, Jan 2, Jan 3 ... (gap 25 days) ... Jan 29, Jan 30.
*   **Result:**
    *   Cluster 1: Jan 1-3
    *   Cluster 2: Jan 29-30

## 2. Average Cycle Length

The cycle length is defined as the number of days from the **start** of one period to the **start** of the next.

**Algorithm:**
1.  Identify the start date of every cluster (Period 1 Start, Period 2 Start, etc.).
2.  Calculate the difference in days between consecutive start dates.
3.  **Filter Outliers:**
    *   **Min Length:** 10 days
    *   **Max Length:** 100 days
    *   Any cycle falling outside this range [10, 100] is considered an anomaly (e.g., data entry error, pregnancy, missed logs) and is **excluded** from the calculation.
4.  **Average:** Calculate the simple mean (average) of the valid cycle lengths.
5.  **Result:** Rounded to the nearest integer.

**Edge Cases:**
*   If fewer than 2 clusters exist, the result is `null` (not enough data).
*   If all calculated intervals are filtered out (e.g., all > 100 days), the result is `null`.

## 3. Average Period Duration

The period duration is the length (in days) of a single bleeding episode.

**Algorithm:**
1.  Calculate the length of each valid cluster (number of logged days).
2.  **Average:** Calculate the simple mean of all cluster lengths.
3.  **Result:** Rounded to the nearest integer.

## 4. Future Predictions

Predictions project the user's cycle into the future based on their historical averages.

**Algorithm:**
1.  **Inputs:**
    *   Last known period start date.
    *   Average Cycle Length (calculated above).
    *   Average Period Duration (calculated above).
2.  **Projection:**
    *   `Next Start Date` = `Last Start Date` + `Avg Cycle Length`.
    *   `Next Period Days` = `Next Start Date` to (`Next Start Date` + `Avg Duration`).
3.  **Loop:** This process repeats, adding the `Avg Cycle Length` to the previous projected start date, until the projection reaches the requested end date (limit).

**Notes:**
*   If the Average Cycle Length cannot be calculated (is `null` or < 10), no predictions are generated.
*   If no Average Duration exists, a default of **5 days** is used.

## 5. Future Ovulation Predictions

Similarly to periods, future ovulation days are projected based on historical averages.

**Algorithm:**
1.  **Inputs:**
    *   Last known marked ovulation date.
    *   Average Cycle Length (calculated above from period clusters).
2.  **Projection:**
    *   `Next Ovulation Date` = `Last Ovulation Date` + `Avg Cycle Length`.
3.  **Loop:** This process repeats, adding the `Avg Cycle Length` to the previous projected ovulation date, until the projection reaches the requested end date (limit).

**Notes:**
*   If the Average Cycle Length cannot be calculated (is `null` or < 10), no predictions are generated.
*   If there are no historically marked ovulation days, no predictions are generated.
