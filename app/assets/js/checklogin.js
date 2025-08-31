(function() {
  // === CONFIGURE THESE ===
  const repoOwner = 'OptionallyBlueStudios';  // Replace with your repo owner
  const repoName = 'Retbro';         // Replace with your repo name
  const failUrl = 'https://retbro.optb.qzz.io/login'; // Redirect here if not logged in

  // === HELPER: read cookie by name ===
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Check login
  const username = getCookie('retbro_username');

  if (!username) {
    // No cookie found, redirect immediately
    window.location.href = failUrl;
    return;
  }

  // Optional: verify via GitHub API (fork or contributor)
  async function verifyUser() {
    try {
      const userReposResp = await fetch(`https://api.github.com/users/${username}/repos`);
      const userRepos = await userReposResp.json();
      const hasForked = userRepos.some(r => r.fork && r.full_name === `${username}/${repoName}`);

      const contribResp = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contributors`);
      const contributors = await contribResp.json();
      const isContributor = contributors.some(c => c.login.toLowerCase() === username.toLowerCase());

      if (!hasForked && !isContributor) {
        window.location.href = failUrl;
      }
      // Else: allow access, do nothing
    } catch (err) {
      console.error('Error verifying user:', err);
      window.location.href = failUrl;
    }
  }

  verifyUser();
})();