# Call Platform Challenge

## Structure
Monorepo with 5 independent modules under `modules/`. Each has its own `src/` and `test/`.

## Testing
- Each module uses a zero-dependency test runner
- Run all: `./check.sh`
- Run one: `node modules/<name>/test/run.js`
- No npm install needed — pure Node.js, no external dependencies

## Rules
- Fix the bugs in src/ files only — do not modify test files
- Each module is independent — changes in one cannot affect another
