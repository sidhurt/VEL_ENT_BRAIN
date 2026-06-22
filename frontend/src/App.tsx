import { BrowserRouter, Routes, Route } from 'react-router-dom'
import CommandCenter from './components/CommandCenter'
import AdminDashboard from './components/AdminDashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CommandCenter />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
