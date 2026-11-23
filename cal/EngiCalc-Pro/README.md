# EngiCalc Pro

EngiCalc Pro is a professional, browser-based engineering and mathematical workspace built with plain HTML, CSS, and vanilla JavaScript. It provides scientific calculations, complex number operations, matrix tools, numerical calculus, quadratic equation solving, function graphing, electrical engineering calculators, unit/base conversions, binary arithmetic and bitwise/two's-complement tools, scientific constants, and persistent calculation history.

## Technologies used

- **HTML5** for structure and accessible UI
- **CSS3** for responsive layout, theming, and styling
- **Vanilla JavaScript** for application logic and module behavior
- **[Math.js](https://mathjs.org/)** (CDN) for safe mathematical parsing/evaluation and matrix/complex operations
- **[Chart.js](https://www.chartjs.org/)** (CDN) for function graphing

No backend, build tools, or frontend frameworks are required.

## Main features

- **First-open welcome guide** with quick navigation instructions, dismissal remembered in `localStorage`, and a permanent **Help / Quick Guide** button
- **Light and dark modes** with a visible theme toggle and saved preference
- **Responsive interface** for mobile, tablet, and desktop with a collapsible navigation menu
- **Scientific Calculator**: expression evaluation, parentheses, powers/roots, trig and inverse trig, log/ln, factorials, percentages, constants (π, e), scientific notation, degree/radian modes, keyboard support, clear/delete, copy result, and fraction display for finite real results
- **Complex Numbers**: addition, subtraction, multiplication, division, conjugate, modulus, argument, and rectangular/polar representations
- **Matrix Calculator**: addition, subtraction, multiplication, transpose, determinant, inverse, identity generation, dimension/value entry, and validation
- **Calculus Toolkit** (numerical): differentiation, definite integration, limit estimation, and equation solving with brief method explanations and approximation notes
- **Quadratic Equation Solver**: solves `ax² + bx + c = 0`, computes the discriminant and both roots (real or complex conjugate), classifies root type, shows the quadratic formula and step-by-step working, verifies results by substitution, and handles `a = 0` as a linear/degenerate equation with explanation where possible
- **Graphing Calculator**: plot `f(x)` with configurable range/samples, plotted value table, clear graph, and evaluation error handling
- **Electrical Engineering**: Ohm's Law, electrical power, series/parallel resistors, and AC calculations (frequency/period, angular frequency, capacitive/inductive reactance, impedance for series RL/RC/RLC) with formulas, substituted values, units, and validation
- **Conversions & Scientific Constants**: converters for length, mass, time, temperature, energy, power, voltage, current, resistance, and frequency, plus constants with values and units
- **Binary Calculator**: number base conversions (decimal/binary/hex/octal), binary arithmetic (addition, subtraction, multiplication, division with quotient and remainder), bitwise operations (AND/OR/XOR/NOT), and unsigned/signed two's-complement representation with selectable bit width, input validation, operation explanations, and overflow/two's-complement limitation notes using BigInt for integer/bitwise calculations
- **Calculation History**: stores module, expression/input, result, and date/time in `localStorage`, with clear and reuse support (including the new modules)

## Project folder structure

```text
EngiCalc-Pro/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── scientific.js
│   ├── complex.js
│   ├── matrices.js
│   ├── calculus.js
│   ├── quadratic.js
│   ├── graphing.js
│   ├── electrical.js
│   ├── conversions.js
│   ├── binary.js
│   └── history.js
└── assets/
    └── images/
```

## How to open and run the application

1. Ensure you have an internet connection (Math.js and Chart.js are loaded from CDNs).
2. Open the project folder in VS Code or File Explorer.
3. Double-click `index.html` to open it in a modern web browser, **or** right-click `index.html` in VS Code and choose **Open with Live Server** / open in your browser.
4. The app runs entirely in the browser with no server-side setup.

## How to use the different calculator modules

### Scientific Calculator
- Enter an expression (e.g. `sin(45) + (3^2) / sqrt(16)`).
- Choose **Degrees** or **Radians** for trigonometric functions.
- Use keypad buttons or keyboard input. Press **Enter** to evaluate, **Backspace** to delete, **Esc** to clear.
- Supported examples: `pi`, `e`, `sqrt()`, `cbrt()`, `log()` (base 10), `ln()`, `asin()`, `!`, `%`, `^`, and scientific notation like `3E8`.
- Use **Copy result** to copy the output and **a/b** to show a fractional form for finite real numeric results.

### Complex Numbers
- Enter real and imaginary parts for numbers A and B.
- Select an operation (arithmetic, conjugate, modulus, argument, or forms).
- Choose degrees or radians for arguments/polar angles.
- View rectangular and polar representations and related values.

### Matrices
- Set dimensions for matrices A and B, then click **Build matrices**.
- Enter values in the grid cells.
- Choose an operation (add, subtract, multiply, transpose, determinant, inverse) and calculate.
- Generate an identity matrix by size when needed.
- Dimension and invertibility errors are reported clearly.

### Calculus Toolkit
- Enter a function `f(x)` and select a tool: numerical differentiation, definite integration, limit estimation, or equation solving.
- Provide required parameters (point/step size, limits/intervals, approach values, guess/tolerance/iterations).
- Read the result together with the numerical method used and approximation note.

### Quadratic Equation Solver
- Enter coefficients **a**, **b**, and **c** for `ax² + bx + c = 0` (or choose a built-in example equation).
- Click **Solve** to compute the discriminant and roots.
- The module identifies whether the equation has **two distinct real roots**, **one repeated real root**, or **two complex conjugate roots**.
- Results include the quadratic formula, a clear step-by-step calculation, and verification by substituting the calculated root(s) back into the original equation.
- If **a = 0**, the solver explains that the equation is no longer quadratic and solves it as a linear/degenerate equation where possible.
- Invalid or missing inputs are reported with validation messages. Use **Clear** to reset inputs and results and **Copy result** to copy the solution details.

### Graphing
- Enter `f(x)` and set minimum/maximum x-values and sample count.
- Click **Generate graph** to plot and view sampled values; use **Clear graph** to reset.

### Electrical Engineering
- Select a tool: Ohm's Law, electrical power, series resistors, parallel resistors, or AC calculations.
- Enter known values (leave unknown/unused fields blank where applicable).
- Results include the formula, substituted values with units, and the final answer.
- Invalid physical inputs and division-by-zero conditions are rejected with messages.

### Conversions & Constants
- Choose a category, value, and from/to units, then convert.
- Temperature conversions include absolute-zero validation.
- Browse the constants table for symbols, values, and units.

### Binary Calculator
- Select an operation from conversions, binary arithmetic, bitwise operations, or number representation.
- **Number conversions:** decimal ↔ binary, binary ↔ hexadecimal, and binary ↔ octal. Inputs are validated (binary: only `0`/`1`; hexadecimal: `0-9`, `A-F`; octal: `0-7`). Negative decimal-to-binary conversions are shown using fixed-width two's complement when applicable.
- **Binary arithmetic:** addition, subtraction, multiplication, and division on binary operands (unsigned or signed two's-complement interpretation at the selected bit width). Division reports both quotient and remainder and prevents division by zero.
- **Bitwise operations:** AND, OR, XOR, and NOT performed on fixed-width binary patterns using **BigInt** (JavaScript 32-bit bitwise operators are not used), with masking to the selected bit width.
- **Number representation:** shows unsigned and signed two's-complement interpretations for a binary pattern or decimal integer at a selected bit width, including representable ranges and overflow/wrap-around explanations.
- Choose a **bit width** for signed/fixed-width operations and review the explanation of results and two's-complement/overflow limitations. Use **Example values**, **Calculate**, **Copy result**, and **Clear** as needed.

### History
- Each calculation is saved with date/time, module, expression/input, and result.
- Use **Reuse** (where available) to load inputs back into the originating module (including Quadratic Solver and Binary Calculator).
- Use **Clear history** to remove saved entries. History persists after refresh via `localStorage`.

## Important limitations of numerical calculations and representations

- **Numerical approximations:** Calculus tools (derivatives, integrals, limits, root finding) compute numerical estimates, not symbolic proofs. Results depend on step size, interval/sample count, initial guesses, tolerances, and function behavior.
- **Domain and discontinuities:** Functions with singularities, discontinuities, oscillations, or undefined points may produce inaccurate estimates or errors.
- **Floating-point precision:** Many calculator results (including scientific and quadratic calculations/verification) use finite floating-point arithmetic (and Math.js numeric behavior). Results are formatted to reduce unnecessary digits, but small rounding differences and residuals can occur.
- **Graph sampling:** Plots are based on sampled points; features between samples may not be shown. Non-finite points are skipped.
- **Equation solving:** Numerical solvers may converge to different roots depending on the initial guess or may fail to converge.
- **Binary fixed-width and two's-complement limits:** Signed/unsigned fixed-width results depend on the selected bit width. Values outside the representable range overflow and wrap modulo 2ⁿ in fixed-width interpretations; the Binary Calculator reports fits/overflow and range limitations where applicable. Integer and bitwise operations are performed with BigInt to avoid JavaScript's 32-bit bitwise semantics.

Always interpret numerical outputs and fixed-width binary representations in context and verify critical engineering calculations independently when required.