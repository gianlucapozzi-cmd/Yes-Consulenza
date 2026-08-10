export function Footer() {
  return (
    <footer className="bg-black">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center gap-4 px-4 py-8 text-sm text-white/70 sm:px-6">
        <img
          src="/logo-yes-on-dark.png?v=bubbles-only-2"
          alt="YES!"
          className="h-14 w-auto object-contain sm:h-16"
        />
        <p className="text-center text-sm text-white/70">
          © YES GROUP SRL | YES! Your English School
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <a
            href="https://www.yourenglishschool.it/privacy/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white hover:underline"
          >
            Privacy Policy
          </a>
          <a
            href="https://www.yourenglishschool.it/cookie-policy/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white hover:underline"
          >
            Cookies Policy
          </a>
        </div>
      </div>
    </footer>
  )
}
