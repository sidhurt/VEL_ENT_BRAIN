import { useState, useEffect } from 'react'
import axios from 'axios'
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card'
import GraphView from './components/GraphView'
import EnhancementConsole from './components/EnhancementConsole'
import FormPanel from './components/FormPanel'
import './App.css'

const API_URL = 'http://localhost:3000/api'
const MOCK_CONSUMER = 'user-john-smith'
const MOCK_ENTERPRISE = 'user-jane-doe'

function App() {
  const [userId, setUserId] = useState(MOCK_ENTERPRISE)
  const [memoryCards, setMemoryCards] = useState<any>(null)
  const [graphData, setGraphData] = useState<any>(null)

  const loadData = async () => {
    try {
      const cardsRes = await axios.get(`${API_URL}/cards/${userId}`)
      setMemoryCards(cardsRes.data)
      const graphRes = await axios.get(`${API_URL}/graph/${userId}`)
      setGraphData(graphRes.data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center border-b">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">ThinkVelocity Unified Brain</h1>
        <div className="flex gap-4">
          <button 
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${userId === MOCK_CONSUMER ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            onClick={() => setUserId(MOCK_CONSUMER)}>
            Consumer Mode (John)
          </button>
          <button 
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${userId === MOCK_ENTERPRISE ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            onClick={() => setUserId(MOCK_ENTERPRISE)}>
            Enterprise Mode (Jane)
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-12 gap-6 h-[calc(100vh-73px)]">
        
        {/* Left Col: Memory Cards */}
        <div className="col-span-3 flex flex-col gap-4 overflow-y-auto pr-2">
          
          <FormPanel userId={userId} apiUrl={API_URL} onComplete={loadData} />

          <h2 className="text-lg font-semibold mb-2 mt-4">Memory Cards</h2>
          
          {memoryCards?.role && (
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500 uppercase tracking-wide">Identity Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-bold">{memoryCards.role.data.role}</p>
                <p className="text-sm text-gray-600">{memoryCards.role.data.domain}</p>
              </CardContent>
            </Card>
          )}

          {memoryCards?.projects?.map((p: any) => (
            <Card key={p.data.id} className={`border-l-4 ${p.data.status === 'Active' ? 'border-l-green-500 shadow-md' : 'border-l-gray-300 opacity-70'}`}>
              <CardHeader className="pb-2 flex flex-row justify-between items-center">
                <CardTitle className="text-sm text-gray-500 uppercase tracking-wide">Project Card</CardTitle>
                <span className={`text-xs px-2 py-1 rounded-full ${p.data.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{p.data.status}</span>
              </CardHeader>
              <CardContent>
                <p className="font-bold">{p.data.name}</p>
              </CardContent>
            </Card>
          ))}

          {memoryCards?.styles?.map((s: any) => (
            <Card key={s.data.id} className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-500 uppercase tracking-wide">Style Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700">{s.data.formattingRules}</p>
              </CardContent>
            </Card>
          ))}

          {memoryCards?.policies?.map((p: any) => (
             <Card key={p.data.id} className="border-l-4 border-l-red-500 bg-red-50">
              <CardHeader className="pb-2 flex flex-row justify-between items-center">
                <CardTitle className="text-sm text-red-700 uppercase tracking-wide font-bold flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  Company Policy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-red-900">{p.data.ruleText}</p>
              </CardContent>
            </Card>
          ))}

        </div>

        {/* Mid Col: Graph Vis */}
        <div className="col-span-5 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Graph Architecture</h2>
            <span className="text-xs text-gray-500">Live Context Assembly</span>
          </div>
          <div className="flex-1 relative">
             {graphData && <GraphView data={graphData} />}
          </div>
        </div>

        {/* Right Col: Enhance Console */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
           <EnhancementConsole userId={userId} apiUrl={API_URL} />
        </div>

      </main>
    </div>
  )
}

export default App
