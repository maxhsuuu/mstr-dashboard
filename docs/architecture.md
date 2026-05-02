# Architecture note

## Core idea

The project separates the work into two layers:

1. **Data collection + preparation layer**
   - Normalize StrategyTracker exports
   - Optionally fetch BTC and MSTR market data
   - Merge everything into one daily dataset

2. **Dashboard layer**
   - Load the prepared dataset
   - Plot a daily time-series chart
   - Let the user switch metric and date range
   - Generate an LLM summary for the visible chart window

## Why this structure helps the assignment

The assignment asks for data collection and a web-based visualization system. If the frontend only uploads a CSV, the data-collection part is weak. This project fixes that by adding standalone Python scripts that document how the dataset was collected and prepared.

## Daily alignment strategy

The project treats the prepared daily CSV as the source of truth for the visualization layer. If supporting BTC data is added, the recommended alignment is to use New York market-close observations when possible, then merge them to the StrategyTracker calendar.
