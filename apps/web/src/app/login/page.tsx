"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authApi } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await authApi.login(identifier, password);
      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login করা যায়নি।");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#f4f7f5] text-[#17211f]">
      <div className="absolute -left-32 -top-40 size-[440px] rounded-full bg-[#dcefe7] blur-3xl opacity-70" />
      <div className="absolute -bottom-52 right-[35%] size-[500px] rounded-full bg-[#e7eee5] blur-3xl opacity-70" />

      <section className="relative hidden w-[52%] flex-col justify-between overflow-hidden bg-[#123c32] px-14 py-12 text-white lg:flex xl:px-20">
        <div className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "radial-gradient(#d6e9df 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="absolute -right-32 top-1/4 size-[500px] rounded-full border border-white/10" />
        <div className="absolute -right-12 top-[31%] size-[340px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[15px] bg-[#75b49b] text-xl font-bold text-[#123c32]">i</div>
          <div><p className="text-base font-semibold tracking-tight">intellinova</p><p className="mt-0.5 text-[10px] tracking-[0.17em] text-white/55">RESEARCH OPERATIONS</p></div>
        </div>
        <div className="relative max-w-xl py-16">
          <div className="mb-6 flex items-center gap-2"><span className="h-px w-8 bg-[#83bba5]"/><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ccab7]">One workspace. Shared progress.</p></div>
          <h1 className="text-5xl font-medium leading-[1.12] tracking-[-0.045em] xl:text-[58px]">Research moves<br/>forward <span className="font-serif italic text-[#9ccab7]">together.</span></h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-white/65">Projects, papers, teams, and the work behind every discovery—organized in one place.</p>
          <div className="mt-12 grid max-w-md grid-cols-3 border-t border-white/15 pt-6">
            <div><p className="text-xl font-semibold">Teams</p><p className="mt-1 text-[11px] text-white/50">working as one</p></div>
            <div className="border-l border-white/15 pl-5"><p className="text-xl font-semibold">Research</p><p className="mt-1 text-[11px] text-white/50">made trackable</p></div>
            <div className="border-l border-white/15 pl-5"><p className="text-xl font-semibold">Progress</p><p className="mt-1 text-[11px] text-white/50">clear to everyone</p></div>
          </div>
        </div>
        <p className="relative text-[11px] text-white/40">© 2026 IntelliNova Research & Organization Management</p>
      </section>

      <section className="relative flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-[14px] bg-[#176b55] text-lg font-bold text-white">i</div>
            <div><p className="text-[15px] font-bold tracking-[-0.03em]">intellinova</p><p className="mt-0.5 text-[10px] tracking-[0.14em] text-[#89948f]">RESEARCH OPERATIONS</p></div>
          </div>
          <div className="rounded-[26px] border border-white/80 bg-white/90 p-7 shadow-[0_24px_80px_-35px_rgba(26,61,49,0.24)] backdrop-blur sm:p-10">
            <div className="mb-8">
              <div className="mb-5 grid size-11 place-items-center rounded-2xl bg-[#eaf4f0] text-lg text-[#176b55]">↗</div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4a9279]">Welcome back</p>
              <h2 className="mt-2 text-[29px] font-semibold tracking-[-0.045em]">Sign in to your workspace</h2>
              <p className="mt-2 text-sm leading-6 text-[#7c8782]">Use your organization account to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#34413b]">Username or work email</span><input autoComplete="off" autoFocus required type="text" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="inrt2100 or you@organization.com" className="h-12 w-full rounded-xl border border-[#e1e8e4] bg-white px-4 text-sm outline-none transition placeholder:text-[#aab3ae] focus:border-[#5b9c83] focus:ring-4 focus:ring-[#5b9c83]/10" /></label>
              <label className="block relative"><span className="mb-2 block text-xs font-semibold text-[#34413b]">Password</span><div className="relative"><input autoComplete="new-password" required type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-[#e1e8e4] bg-white px-4 pr-10 text-sm outline-none transition placeholder:text-[#aab3ae] focus:border-[#5b9c83] focus:ring-4 focus:ring-[#5b9c83]/10" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#89948f] hover:text-[#176b55]">{showPassword ? "Hide" : "Show"}</button></div></label>
              {error && <div role="alert" className="rounded-xl border border-[#f0d6d1] bg-[#fff7f5] px-4 py-3 text-xs leading-5 text-[#a3493a]">{error}</div>}
              <button disabled={submitting} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#176b55] text-sm font-semibold text-white shadow-sm transition hover:bg-[#125a47] disabled:cursor-not-allowed disabled:opacity-65">{submitting ? <><span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white"/>Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}</button>
            </form>
            <div className="mt-7 flex items-center gap-3"><span className="h-px flex-1 bg-[#edf0ee]"/><span className="text-[10px] text-[#a0aaa5]">SECURE ORGANIZATION ACCESS</span><span className="h-px flex-1 bg-[#edf0ee]"/></div>
            <p className="mt-6 text-center text-[11px] leading-5 text-[#89948f]">Need access? Contact your organization administrator.</p>
          </div>
          <p className="mt-6 text-center text-[10px] text-[#9aa39f]">By signing in, you agree to your organization’s access policies.</p>
          <div className="mt-4 text-center"><Link href="/" className="text-[11px] text-[#718079] underline decoration-[#c9d4ce] underline-offset-4 hover:text-[#176b55]">Back to workspace</Link></div>
        </div>
      </section>
    </main>
  );
}
