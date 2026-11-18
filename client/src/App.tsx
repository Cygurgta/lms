import { Navigate, Route, Routes, Link } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Shell } from './components/ui';
import { PageHead } from './components/ui';
import { Empty } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Grades from './pages/Grades';
import Notifications from './pages/Notifications';
import Structure from './pages/Structure';
import Profile from './pages/Profile';
import Chat from './pages/Chat';
import UsersPage from './pages/Users';

function Protected({ children, roles }: { children: React.ReactNode; roles?: Array<'ADMIN'|'LECTURER'|'LEARNER'> }) {
  const { session, restoring } = useAuth();
  if (restoring) return <div className="grid min-h-screen place-items-center text-forest">Restoring your session…</div>;
  if (!session) return <Navigate to="/login" replace/>;
  if (roles && !roles.includes(session.user.role)) return <Shell><PageHead eyebrow="Access denied" title="You don’t have access to this page"/><Link to="/" className="btn-primary">Return to dashboard</Link></Shell>;
  return <Shell>{children}</Shell>;
}

function NotFound() { return <Protected><PageHead eyebrow="404" title="Page not found"/><Empty title="We couldn’t find that page" body="The address may have changed or the page may no longer exist."/><Link to="/" className="btn-primary mt-4">Return to dashboard</Link></Protected>; }

export default function App() { return <Routes>
  <Route path="/login" element={<Login/>}/>
  <Route path="/" element={<Protected><Dashboard/></Protected>}/>
  <Route path="/courses" element={<Protected><Courses/></Protected>}/>
  <Route path="/courses/:id" element={<Protected><CourseDetail/></Protected>}/>
  <Route path="/grades" element={<Protected roles={['LEARNER']}><Grades/></Protected>}/>
  <Route path="/notifications" element={<Protected><Notifications/></Protected>}/>
  <Route path="/structure" element={<Protected roles={['ADMIN']}><Structure/></Protected>}/>
  <Route path="/users" element={<Protected roles={['ADMIN']}><UsersPage/></Protected>}/>
  <Route path="/profile" element={<Protected><Profile/></Protected>}/>
  <Route path="/people/:id" element={<Protected><Profile/></Protected>}/>
  <Route path="/chat" element={<Protected><Chat/></Protected>}/>
  <Route path="*" element={<NotFound/>}/>
</Routes>; }
