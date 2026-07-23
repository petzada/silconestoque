import { redirect } from 'next/navigation';

export default function VestiarioRedirect() {
  redirect('/lockers?tab=vestiario');
}
