import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-gray-500">页面不存在</p>
        <Link
          href="/resumes"
          className="inline-block text-sm text-blue-600 hover:underline"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}
