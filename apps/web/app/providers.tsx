"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GAME_VERSIONS, type Edition, type GameVersion } from "@fangyu/domain";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "dark" | "light";
type Language = "zh-TW" | "en";

interface PortalContextValue {
  edition: Edition;
  gameVersion: GameVersion;
  versions: GameVersion[];
  language: Language;
  theme: Theme;
  favorites: Set<string>;
  setEdition: (edition: Edition) => void;
  setGameVersionId: (id: string) => void;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  toggleFavorite: (id: string) => void;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [edition, updateEdition] = useState<Edition>("java");
  const [gameVersionId, updateGameVersionId] = useState("java-demo-1");
  const [language, updateLanguage] = useState<Language>("zh-TW");
  const [theme, updateTheme] = useState<Theme>("dark");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedEdition = window.localStorage.getItem("fangyu:edition");
    const savedVersion = window.localStorage.getItem("fangyu:version");
    const savedLanguage = window.localStorage.getItem("fangyu:language");
    const savedTheme = window.localStorage.getItem("fangyu:theme");
    const savedFavorites = window.localStorage.getItem("fangyu:favorites");

    if (savedEdition === "java" || savedEdition === "bedrock") {
      updateEdition(savedEdition);
      const matching = GAME_VERSIONS.some(
        (version) =>
          version.edition === savedEdition && version.id === savedVersion,
      );
      updateGameVersionId(
        matching
          ? (savedVersion as string)
          : (GAME_VERSIONS.find((version) => version.edition === savedEdition)
              ?.id ?? "java-demo-1"),
      );
    }
    if (savedLanguage === "zh-TW" || savedLanguage === "en") {
      updateLanguage(savedLanguage);
    }
    if (savedTheme === "dark" || savedTheme === "light") {
      updateTheme(savedTheme);
    }
    if (savedFavorites) {
      try {
        setFavorites(new Set(JSON.parse(savedFavorites) as string[]));
      } catch {
        setFavorites(new Set());
      }
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("fangyu:theme", theme);
  }, [theme]);

  const versions = useMemo(
    () => GAME_VERSIONS.filter((version) => version.edition === edition),
    [edition],
  );
  const gameVersion =
    versions.find((version) => version.id === gameVersionId) ??
    versions[0] ??
    GAME_VERSIONS[0];

  if (!gameVersion) {
    throw new Error("At least one fixture version is required.");
  }

  function setEdition(nextEdition: Edition) {
    updateEdition(nextEdition);
    const nextVersion = GAME_VERSIONS.find(
      (version) => version.edition === nextEdition,
    );
    if (nextVersion) {
      updateGameVersionId(nextVersion.id);
      window.localStorage.setItem("fangyu:version", nextVersion.id);
    }
    window.localStorage.setItem("fangyu:edition", nextEdition);
  }

  function setGameVersionId(id: string) {
    if (versions.some((version) => version.id === id)) {
      updateGameVersionId(id);
      window.localStorage.setItem("fangyu:version", id);
    }
  }

  function setLanguage(nextLanguage: Language) {
    updateLanguage(nextLanguage);
    window.localStorage.setItem("fangyu:language", nextLanguage);
  }

  function setTheme(nextTheme: Theme) {
    updateTheme(nextTheme);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      window.localStorage.setItem(
        "fangyu:favorites",
        JSON.stringify([...next]),
      );
      return next;
    });
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PortalContext.Provider
        value={{
          edition,
          gameVersion,
          versions,
          language,
          theme,
          favorites,
          setEdition,
          setGameVersionId,
          setLanguage,
          setTheme,
          toggleFavorite,
        }}
      >
        {children}
      </PortalContext.Provider>
    </QueryClientProvider>
  );
}

export function usePortal() {
  const context = useContext(PortalContext);
  if (!context) {
    throw new Error("usePortal must be used inside PortalProvider");
  }
  return context;
}
