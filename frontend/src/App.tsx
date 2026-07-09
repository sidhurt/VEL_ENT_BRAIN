import { BrowserRouter, Routes, Route } from 'react-router-dom'
import JarvisWorkspace from './components/JarvisWorkspace'
import EnterpriseBrain from './components/EnterpriseBrain'
import ClientRoom from './components/ClientRoom'
import AppNav from './components/AppNav'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientRoom />} />
        <Route path="/clients" element={<ClientRoom />} />
        <Route path="/workspace" element={<JarvisWorkspace />} />
        <Route path="/enterprise" element={<EnterpriseBrain />} />
      </Routes>
      <AppNav />
    </BrowserRouter>
  )
}

export default App
