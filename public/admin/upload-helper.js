/*
 * Ajutor pentru incarcarea pozelor in Decap CMS de pe orice dispozitiv (telefon, tableta, PC).
 *
 * Problema: pozele facute cu telefonul au 3-12 MB si 4000+ px. Urcate asa, umplu
 * repository-ul, pot depasi limita git-gateway si incetinesc site-ul.
 *
 * Solutia: interceptam selectia de fisiere din admin INAINTE ca Decap s-o proceseze si:
 *  - rotim corect poza (orientarea EXIF de la telefon);
 *  - o micsoram la maximum 2400 px pe latura lunga si o salvam ca JPEG de calitate buna;
 *  - curatam numele fisierului (fara spatii/diacritice, cu marca de timp ca sa fie unic).
 * Daca browserul nu poate decoda poza (ex. HEIC pe Android/PC), o lasam neschimbata.
 * La build, scripts/optimize-images.mjs genereaza oricum variantele WebP pentru site.
 */
(function () {
  "use strict";

  var MAX_DIMENSION = 2400;
  var JPEG_QUALITY = 0.85;
  var MAX_BYTES_UNTOUCHED = 1.2 * 1024 * 1024;
  var IMAGE_RE = /\.(jpe?g|png|webp|heic|heif|avif)$/i;
  var HEIC_RE = /\.(heic|heif)$/i;
  var released = new WeakSet();

  var supportsDataTransfer = (function () {
    try {
      return typeof DataTransfer !== "undefined" && !!new DataTransfer().items;
    } catch (e) {
      return false;
    }
  })();

  function slugify(value) {
    return (
      String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "poza"
    );
  }

  function stamp() {
    var d = new Date();
    var pad = function (n) {
      return String(n).padStart(2, "0");
    };
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function isImage(file) {
    return /^image\//i.test(file.type) || IMAGE_RE.test(file.name);
  }

  function decode(file) {
    if ("createImageBitmap" in window) {
      return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
        return decodeWithImg(file);
      });
    }
    return decodeWithImg(file);
  }

  function decodeWithImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        resolve(img);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 1000);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("decode"));
      };
      img.src = url;
    });
  }

  function renamed(file, name) {
    return new File([file], name, { type: file.type, lastModified: Date.now() });
  }

  function prepare(file, index) {
    if (!isImage(file) || /svg|gif/i.test(file.type)) return Promise.resolve(file);

    var base = slugify(file.name.replace(/\.[^.]+$/, "")) + "-" + stamp() + (index ? "-" + index : "");
    var originalExt = (file.name.match(/\.([^.]+)$/) || [, "jpg"])[1].toLowerCase();

    return decode(file).then(
      function (bitmap) {
        var width = bitmap.width;
        var height = bitmap.height;
        var scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        var needsWork = scale < 1 || file.size > MAX_BYTES_UNTOUCHED || HEIC_RE.test(file.name);
        if (!needsWork) {
          if (bitmap.close) bitmap.close();
          return renamed(file, base + "." + originalExt);
        }

        var canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // fundal alb pentru PNG-uri cu transparenta
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        if (bitmap.close) bitmap.close();

        return new Promise(function (resolve) {
          canvas.toBlob(
            function (blob) {
              // daca recompresia nu ajuta (rar), pastram originalul
              if (!blob || blob.size >= file.size) resolve(renamed(file, base + "." + originalExt));
              else resolve(new File([blob], base + ".jpg", { type: "image/jpeg", lastModified: Date.now() }));
            },
            "image/jpeg",
            JPEG_QUALITY,
          );
        });
      },
      function () {
        if (HEIC_RE.test(file.name)) {
          window.alert(
            "Formatul HEIC nu poate fi afișat pe site.\n\nPe iPhone: Setări → Cameră → Formate → „Cel mai compatibil”, sau trimite poza ca JPG.",
          );
        }
        return renamed(file, base + "." + originalExt);
      },
    );
  }

  var overlay;
  function busy(show) {
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.setAttribute("role", "status");
      overlay.style.cssText =
        "position:fixed;inset:auto 1rem 1rem auto;z-index:99999;background:#8b5e3c;color:#fff;padding:.8rem 1.1rem;border-radius:999px;font:600 14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
      overlay.textContent = "Se optimizează poza…";
    }
    if (show) document.body.appendChild(overlay);
    else if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  window.addEventListener(
    "change",
    function (event) {
      var input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      if (!input.files || input.files.length === 0 || !supportsDataTransfer) return;
      if (released.has(input)) {
        released.delete(input);
        return; // evenimentul re-emis de noi: il lasam sa ajunga la Decap
      }

      var files = Array.prototype.slice.call(input.files);
      if (!files.some(isImage)) return;

      event.stopImmediatePropagation();
      busy(true);

      Promise.all(files.map(prepare))
        .catch(function () {
          return files;
        })
        .then(function (prepared) {
          var dt = new DataTransfer();
          prepared.forEach(function (file) {
            dt.items.add(file);
          });
          input.files = dt.files;
        })
        .finally(function () {
          busy(false);
          released.add(input);
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
    },
    true,
  );
})();
