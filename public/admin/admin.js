/* Integrare Netlify Identity pentru panoul de administrare Decap CMS. */
(function () {
  "use strict";

  // Linkurile din emailurile Netlify (resetare parola, invitatie, confirmare) se proceseaza
  // pe /confirm/, unde nu ruleaza Decap: Decap rescrie hash-ul URL-ului la pornire si
  // fereastra „parola noua” nu mai apuca sa apara.
  var tokenSource = location.hash || (location.search ? "#" + location.search.replace(/^\?/, "") : "");
  if (/(invite|confirmation|recovery|email_change)_token=/.test(tokenSource)) {
    location.replace("/confirm/" + tokenSource);
    return;
  }

  if (window.netlifyIdentity) {
    window.netlifyIdentity.on("login", function () {
      window.netlifyIdentity.close();
      if (location.hash.indexOf("#/") !== 0) location.href = "/admin/#/";
    });
  }
})();
