import { ImagePlus, Moon, Sparkles, Upload } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { createThumbnail } from "./lib/api";
import type { Thumbnail } from "./lib/assets";
import logo from "./assets/thumbnailgo/logo.svg";

type AuthMode = "register" | "signin";
type Page = "auth" | "generate" | "account";

interface SavedUser {
  name: string;
  password: string;
}

const usersKey = "thumbnailgo_users";
const oldUserKey = "thumbnailgo_user";
const sessionKey = "thumbnailgo_session";

function getUsers() {
  const users = JSON.parse(localStorage.getItem(usersKey) || "[]") as SavedUser[];
  const oldUser = localStorage.getItem(oldUserKey);

  if (!users.length && oldUser) {
    const migratedUser = JSON.parse(oldUser) as SavedUser;
    localStorage.setItem(usersKey, JSON.stringify([migratedUser]));
    return [migratedUser];
  }

  return users;
}

function saveUsers(users: SavedUser[]) {
  localStorage.setItem(usersKey, JSON.stringify(users));
}

function getGenerationsKey(userName: string) {
  return `thumbnailgo_generations_${userName.toLowerCase()}`;
}

function getStoredGenerations(userName: string) {
  return JSON.parse(localStorage.getItem(getGenerationsKey(userName)) || "[]") as Thumbnail[];
}

function saveStoredGenerations(userName: string, generations: Thumbnail[]) {
  localStorage.setItem(getGenerationsKey(userName), JSON.stringify(generations));
}

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [signedInUser, setSignedInUser] = useState<SavedUser | null>(() => {
    const sessionName = localStorage.getItem(sessionKey);
    if (!sessionName) return null;
    return getUsers().find((user) => user.name === sessionName) ?? null;
  });
  const [page, setPage] = useState<Page>(() => (localStorage.getItem(sessionKey) ? "generate" : "auth"));
  const [generations, setGenerations] = useState<Thumbnail[]>(() => {
    const sessionName = localStorage.getItem(sessionKey);
    return sessionName ? getStoredGenerations(sessionName) : [];
  });
  const [latestGeneration, setLatestGeneration] = useState<Thumbnail | null>(() => generations[0] ?? null);

  async function generate() {
    if (!signedInUser) {
      setPage("auth");
      setAuthMessage("Please register and sign in before generating.");
      return;
    }

    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStatusMessage("");

    try {
      const thumbnail = await createThumbnail({
        title: prompt.trim(),
        style: "Bold & Graphic",
        aspectRatio: "16:9",
        colorSchemeId: "vibrant",
        additionalDetails: "clean readable text, high contrast, YouTube thumbnail composition",
      });
      const updatedGenerations = [thumbnail, ...generations];
      setGenerations(updatedGenerations);
      setLatestGeneration(thumbnail);
      saveStoredGenerations(signedInUser.name, updatedGenerations);
      setStatusMessage("Generated and saved to your account.");
    } catch {
      setStatusMessage("Could not generate. Make sure the backend server is running.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");

    const cleanName = name.trim();
    if (!cleanName || !password.trim()) {
      setAuthMessage("Fill in your name and password.");
      return;
    }

    const users = getUsers();

    if (authMode === "register") {
      const alreadyExists = users.some((user) => user.name.toLowerCase() === cleanName.toLowerCase());
      if (alreadyExists) {
        setAuthMessage("That name is already registered. Sign in instead.");
        setAuthMode("signin");
        return;
      }

      const newUser = { name: cleanName, password };
      saveUsers([...users, newUser]);
      setPassword("");
      setAuthMode("signin");
      setAuthMessage("Registered. Now sign in to start generating.");
      return;
    }

    const user = users.find((item) => item.name.toLowerCase() === cleanName.toLowerCase());
    if (!user || user.password !== password) {
      setAuthMessage("Name or password is incorrect.");
      return;
    }

    localStorage.setItem(sessionKey, user.name);
    const savedGenerations = getStoredGenerations(user.name);
    setSignedInUser(user);
    setGenerations(savedGenerations);
    setLatestGeneration(savedGenerations[0] ?? null);
    setPassword("");
    setStatusMessage("");
    setPage("generate");
    window.location.hash = "generate";
  }

  function signOut() {
    localStorage.removeItem(sessionKey);
    setSignedInUser(null);
    setGenerations([]);
    setLatestGeneration(null);
    setPrompt("");
    setAuthMessage("Signed out.");
    setPage("auth");
    window.location.hash = "auth";
  }

  return (
    <div className="siteShell">
      <header className="topbar">
        <button
          className="logoLockup"
          onClick={() => {
            setPage(signedInUser ? "generate" : "auth");
            window.location.hash = signedInUser ? "generate" : "auth";
          }}
          type="button"
        >
          <img src={logo} alt="ThumbnailGo" />
        </button>
        <div className="navActions">
          {signedInUser ? (
            <>
              <button
                className={page === "generate" ? "navText active" : "navText"}
                onClick={() => {
                  setPage("generate");
                  window.location.hash = "generate";
                }}
                type="button"
              >
                Generate
              </button>
              <button
                className={page === "account" ? "navText active" : "navText"}
                onClick={() => {
                  setPage("account");
                  window.location.hash = "account";
                }}
                type="button"
              >
                My Account
              </button>
            </>
          ) : null}
          <button className="themeButton" type="button" aria-label="Toggle theme">
            <Moon size={18} />
          </button>
          {signedInUser ? (
            <button className="signin" onClick={signOut} type="button">
              Sign Out
            </button>
          ) : (
            <button className="signin" onClick={() => setPage("auth")} type="button">
              Sign In
            </button>
          )}
        </div>
      </header>

      <main id="top">
        {!signedInUser || page === "auth" ? (
          <section className="heroSection authPage" id="auth">
            <div className="heroText">
              <h1>Create thumbnails.</h1>
              <p>Register or sign in first. After that, the Generate page opens.</p>
            </div>

            <div className="authCard">
              <form onSubmit={handleAuth}>
                <div className="authTabs">
                  <button
                    className={authMode === "register" ? "active" : ""}
                    onClick={() => {
                      setAuthMode("register");
                      setAuthMessage("");
                    }}
                    type="button"
                  >
                    Register
                  </button>
                  <button
                    className={authMode === "signin" ? "active" : ""}
                    onClick={() => {
                      setAuthMode("signin");
                      setAuthMessage("");
                    }}
                    type="button"
                  >
                    Sign In
                  </button>
                </div>

                <input aria-label="Name" onChange={(event) => setName(event.target.value)} placeholder="Your name" value={name} />
                <input
                  aria-label="Password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  type="password"
                  value={password}
                />
                <button className="authSubmit" type="submit">
                  {authMode === "register" ? "Register" : "Sign In"}
                </button>
              </form>
              {authMessage ? <p className="authMessage">{authMessage}</p> : null}
            </div>
          </section>
        ) : null}

        {signedInUser && page === "generate" ? (
          <section className="heroSection generatePage" id="generate">
            <div className="heroText">
              <h1>Generate thumbnail.</h1>
              <p>Signed in as {signedInUser.name}. Type your thumbnail idea below.</p>
            </div>

            <div className="promptCard">
              <textarea
                aria-label="Thumbnail prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe your thumbnail... epic gaming battle"
              />
              <div className="promptActions">
                <button className="uploadButton" type="button" aria-label="Upload reference">
                  <Upload size={18} />
                </button>
                <button className="generateFree" disabled={!prompt.trim() || isGenerating} onClick={generate} type="button">
                  {isGenerating ? "Generating..." : "Generate Image"}
                  <Sparkles size={17} />
                </button>
              </div>
            </div>

            {statusMessage ? <p className="statusMessage">{statusMessage}</p> : null}

            {latestGeneration ? (
              <article className="resultCard">
                <img src={latestGeneration.image_url} alt={latestGeneration.title} />
                <div>
                  <strong>{latestGeneration.title}</strong>
                  <span>
                    Saved in My Account
                    {latestGeneration.provider ? ` / ${latestGeneration.provider}` : ""}
                  </span>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {signedInUser && page === "account" ? (
          <section className="heroSection accountPage">
            <div className="heroText">
              <h1>My Account.</h1>
              <p>{generations.length ? `${generations.length} saved generation${generations.length === 1 ? "" : "s"}.` : "Your generated images will appear here."}</p>
            </div>

            <div className="accountPanel">
              {generations.length ? (
                <div className="generationGrid">
                  {generations.map((generation) => (
                    <article className="generationCard" key={generation._id}>
                      <img src={generation.image_url} alt={generation.title} />
                      <div>
                        <strong>{generation.title}</strong>
                        <a href={generation.image_url} download={`${generation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.svg`}>
                          Download
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="emptyState">
                  <ImagePlus size={30} />
                  <p>No generations yet.</p>
                  <button onClick={() => setPage("generate")} type="button">
                    Generate one
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
