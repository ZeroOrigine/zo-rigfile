// CANONICAL: /drivers index — driver management lives on the dashboard, so this
// route simply redirects there instead of shipping a placeholder page.
import { redirect } from 'next/navigation'

export default function DriversIndexPage() {
  redirect('/dashboard')
}
