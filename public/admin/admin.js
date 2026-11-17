/* Integrare Netlify Identity pentru panoul de administrare Decap CMS. */
(function () {
  "use strict";

  // Linkurile din emailurile Netlify (?token=...) ajung uneori ca query; Identity le vrea in hash.
  if (location.search && !location.hash) {
    location.replace("/admin/#" + location.search.replace(/^\?/, ""));
    return;
  }

  if (window.netlifyIdentity) {
    window.netlifyIdentity.on("login", function () {
      window.netlifyIdentity.close();
      if (location.hash.indexOf("#/") !== 0) location.href = "/admin/#/";
    });
  }
})();
