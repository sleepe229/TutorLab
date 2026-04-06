import TutorSidebar from './TutorSidebar';

/**
 * TutorNav is now a thin wrapper around TutorSidebar.
 * All existing prop calls (tutorId, activePage, onLogout, breadcrumb, extraActions)
 * continue to work without changes in consumers.
 */
function TutorNav(props) {
  return <TutorSidebar {...props} />;
}

export default TutorNav;
