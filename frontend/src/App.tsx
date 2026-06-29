import { BrowserRouter, Routes, Route } from 'react-router-dom'
import JarvisWorkspace from './components/JarvisWorkspace'
import EnterpriseBrain from './components/EnterpriseBrain'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<JarvisWorkspace />} />
        <Route path="/enterprise" element={<EnterpriseBrain />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
