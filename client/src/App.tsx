import { Sparkles, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { createThumbnail, deleteThumbnail } from "./lib/api";
import type { Thumbnail } from "./lib/assets";
import { composeThumbnailWithTitle } from "./lib/overlay";

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
        additionalDetails: "no text, no words, no letters, no captions in the image, clean background art only",
      });

      const needsOverlay = !thumbnail.provider?.startsWith("local-fallback");
      if (needsOverlay) {
        try {
          thumbnail.image_url = await composeThumbnailWithTitle(thumbnail.image_url, thumbnail.title);
        } catch {
          // If compositing fails for any reason, fall back to the raw generated image.
        }
      }

      const updatedGenerations = [thumbnail, ...generations];
      setGenerations(updatedGenerations);
      setLatestGeneration(thumbnail);
      saveStoredGenerations(signedInUser.name, updatedGenerations);
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

  async function removeGeneration(generation: Thumbnail) {
    if (!signedInUser) return;

    const updatedGenerations = generations.filter((item) => item._id !== generation._id);
    setGenerations(updatedGenerations);
    setLatestGeneration((current) => (current?._id === generation._id ? updatedGenerations[0] ?? null : current));
    saveStoredGenerations(signedInUser.name, updatedGenerations);

    try {
      await deleteThumbnail(generation._id);
    } catch {
      // Local browser generations still delete even when the optional backend store is unavailable.
    }
  }

  return (
    <div className="siteShell">
      <header className="topbar">
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
              <h1><span>Create</span> thumbnails.</h1>
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
              <h1><span>Generate</span> thumbnail.</h1>
              <p>Signed in as {signedInUser.name}. Type your thumbnail idea below.</p>
            </div>

            <div className="promptCard">
              <textarea
                aria-label="Thumbnail prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe your thumbnail..."
              />
              <div className="promptActions">
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
                  <span>Saved in My Account</span>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {signedInUser && page === "account" ? (
          <section className="heroSection accountPage">
            <div className="heroText">
              <h1>My <span>Account</span>.</h1>
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
                        <div className="generationActions">
                          <a href={generation.image_url} download={`${generation.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`}>
                            Download
                          </a>
                          <button aria-label={`Delete ${generation.title}`} onClick={() => removeGeneration(generation)} type="button">
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="emptyState">
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
