import { useState } from "react";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export function LoginPage(): JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      await login(username, password);
      navigate("/");
    } catch (error: unknown) {
      if (isAxiosError<{ detail?: string }>(error)) {
        setError(error.response?.data?.detail ?? "Invalid username or password");
        return;
      }
      setError("Login failed. Check credentials.");
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h2>Sign In</h2>
        <p className="muted">Use seeded admin account for first login.</p>
        <label>
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
