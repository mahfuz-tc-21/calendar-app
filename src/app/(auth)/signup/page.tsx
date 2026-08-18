import AuthForm from '@/components/auth/AuthForm'

export default function SignupPage() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen px-4 bg-gray-50">
      <AuthForm mode="signup" />
    </div>
  )
}
