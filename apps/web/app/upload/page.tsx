import { redirect } from 'next/navigation'

export default function UploadRedirect(): never {
  redirect('/contracts/upload')
}

