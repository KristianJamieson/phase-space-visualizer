# Phase-Space Visualizer (ẋ = f(x))
**Author:** Kristian Jamieson  
**Course:** Modeling and Analysis Project  

An interactive web app to visualize 2D cross-sections of *n*-dimensional autonomous systems  
\[
\dot{x} = f(x), \quad x \in \mathbb{R}^n
\]

Users can define the system, select which two dimensions to view, and explore trajectories in phase space.

---

## 🚀 Features
- Define any dimension \( n \) and arbitrary equations \( f(x) \)
- Choose 2D slices \( (x_i, x_j) \) to visualize
- Hold other coordinates fixed with a JSON array
- Draw trajectories by clicking in the canvas
- Real-time vector field visualization
- Uses **4th-order Runge–Kutta** integration (RK4)
- Built with React + TypeScript + MathJS

---

## 🧰 Installation
To reproduce locally:
```bash
git clone https://github.com/KristianJamieson/phase-space-visualizer.git
cd phase-space-visualizer
npm install
npm run dev
