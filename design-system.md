Core Stack
React: The entire UI is built using React functional components and Hooks (useState, useEffect, useRef, etc.).
TypeScript: Used for type safety (you can see types like <any[]>, <string>, and React.FormEvent throughout the code).
Tailwind CSS: All the styling, layout, animations, and dark mode features are handled by Tailwind utility classes (e.g., flex, bg-[#0B0E11], text-emerald-500, rounded-2xl, hover:bg-white/5).
External Libraries
Recharts (recharts): Used in the "Manage Server" tab to render the responsive, animated CPU and Memory line charts.
Xterm.js (@xterm/xterm & @xterm/addon-fit): Used in the "Shell" tab to create the fully functional, browser-based SSH terminal emulator. It handles the rendering of terminal text, colors, and user input.
Architecture & Patterns
State Management (React Context API): Instead of using a heavy library like Redux, I created a custom hook called useDashboardState that holds all the application state, and passed it down through the app using React's native createContext and useContext.
Hash-Based Routing: Instead of using a complex router like react-router-dom, I used a lightweight approach reading window.location.hash to switch between the different tabs (Dashboard, Servers, Networks, etc.).
WebSockets: Native browser WebSockets (new WebSocket(...)) are used in the Shell component to establish a real-time, two-way connection for the SSH terminal.
Vite: The environment variables (import.meta.env.VITE_APP_URL) indicate this is built on top of Vite, a lightning-fast modern build tool.
Design Choices
Unicode Icons: Instead of importing an external icon library (like FontAwesome or Lucide), I used clean Unicode characters (like ⬡, ▦, ◈, >_, ⏰) for the sidebar navigation. This keeps the application extremely lightweight and gives it a cool, technical, "hacker" aesthetic.
Glassmorphism & Dark Mode: The UI uses Tailwind's backdrop-blur combined with semi-transparent borders (border-white/10) and backgrounds (bg-[#131620]) to create a modern, sleek interface that easily toggles between light and dark themes