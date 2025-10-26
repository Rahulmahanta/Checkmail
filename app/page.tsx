'use client'

import { signIn, useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { redirect } from "next/navigation";

export default function Home() {
  const { data: session, status } = useSession();
  const [openaiKey, setOpenaiKey] = useState("");
  const [showOpenaiInput, setShowOpenaiInput] = useState(false);

  // If user is logged in, redirect to dashboard
  useEffect(() => {
    if (status === 'authenticated') {
      redirect("/dashboard");
    }
  }, [status]);

  const handleGoogleLogin = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleOpenaiClick = () => {
    setShowOpenaiInput(true);
  };

  const handleOpenaiSubmit = (e) => {
    e.preventDefault();
    // Store OpenAI key in localStorage or session storage
    localStorage.setItem("openai_api_key", openaiKey);
    // Redirect to dashboard
    window.location.href = "/dashboard";
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white font-sans">
      <main className="flex min-h-screen w-full flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-12">
          {/* Login Button Container */}
          <div className="border border-black rounded-md p-4 w-64 text-center">
            <button 
              className="font-medium text-black"
              onClick={handleGoogleLogin}
            >
              Login with Google
            </button>
          </div>
          
          {/* OpenAI API Key Input Container */}
          <div className="border border-black rounded-md p-4 w-96 text-center">
            {!showOpenaiInput ? (
              <button 
                className="font-medium text-black"
                onClick={handleOpenaiClick}
              >
                Enter OpenAI API
              </button>
            ) : (
              <form onSubmit={handleOpenaiSubmit} className="flex flex-col gap-2">
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="Enter your OpenAI API key"
                  className="border border-gray-300 p-2 rounded"
                  required
                />
                <button 
                  type="submit"
                  className="font-medium text-black bg-gray-100 p-2 rounded hover:bg-gray-200"
                >
                  Submit
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
