import { useState } from 'react'
import * as api from '../api'
import './Autentificare.css'

export default function Autentificare({ onAutentificat }) {
  const [esteRegister, setEsteRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [parola, setParola] = useState('')
  const [arataParola, setArataParola] = useState(false)
  const [eroare, setEroare] = useState('')
  const [succes, setSucces] = useState('')
  const [incarcare, setIncarcare] = useState(false)

  function comutaMod() {
    setEsteRegister(!esteRegister)
    setEroare('')
    setSucces('')
  }

  async function trimite(e) {
    e.preventDefault()
    setEroare('')
    setSucces('')
    setIncarcare(true)

    try {
      if (esteRegister) {
        await api.register(username, parola)
        setSucces('Cont creat. Te poti autentifica.')
        setEsteRegister(false)
        setParola('')
      } else {
        const res = await api.login(username, parola)
        localStorage.setItem('token', res.token)
        onAutentificat(res.username)
      }
    } catch (err) {
      setEroare(err.message)
    } finally {
      setIncarcare(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2 className="auth-titlu">
          {esteRegister ? 'Creare cont' : 'Autentificare'}
        </h2>

        <form onSubmit={trimite} className="auth-form">
          <div className="auth-rand">
            <label htmlFor="user">Utilizator</label>
            <input
              id="user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="auth-rand">
            <label htmlFor="pass">Parola</label>
            <div className="auth-parola-wrap">
              <input
                id="pass"
                type={arataParola ? 'text' : 'password'}
                value={parola}
                onChange={(e) => setParola(e.target.value)}
                required
              />
              <button
                type="button"
                className="auth-btn-vezi"
                onClick={() => setArataParola(!arataParola)}
              >
                {arataParola ? 'Ascunde' : 'Arata'}
              </button>
            </div>
          </div>

          {eroare && <div className="auth-eroare">{eroare}</div>}
          {succes && <div className="auth-succes">{succes}</div>}

          <button type="submit" className="auth-btn-submit" disabled={incarcare}>
            {incarcare ? 'Se incarca...' : esteRegister ? 'Inregistrare' : 'Intra in cont'}
          </button>
        </form>

        <div className="auth-schimba">
          {esteRegister ? 'Ai deja cont?' : 'Nu ai cont?'}
          <button type="button" onClick={comutaMod}>
            {esteRegister ? 'Autentifica-te' : 'Creeaza unul'}
          </button>
        </div>
      </div>
    </div>
  )
}