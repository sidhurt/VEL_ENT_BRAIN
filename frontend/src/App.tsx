import { BrowserRouter, Routes, Route } from 'react-router-dom'
import JarvisWorkspace from './components/JarvisWorkspace'
import EnterpriseBrain from './components/EnterpriseBrain'
import ClientRoom from './components/ClientRoom'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ClientRoom />} />
        <Route path="/clients" element={<ClientRoom />} />
        <Route path="/workspace" element={<JarvisWorkspace />} />
        <Route path="/enterprise" element={<EnterpriseBrain />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
