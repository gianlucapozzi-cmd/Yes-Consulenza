import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConsulenzaPage } from './pages/ConsulenzaPage'
import { OpenDayPage } from './pages/OpenDayPage'
import { ThankYouPage } from './pages/ThankYouPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ConsulenzaPage />} />
        <Route path="/consulenza" element={<Navigate to="/" replace />} />
        <Route path="/open-day" element={<OpenDayPage />} />
        <Route path="/grazie" element={<ThankYouPage />} />
        <Route path="/thank-you" element={<Navigate to="/grazie" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
