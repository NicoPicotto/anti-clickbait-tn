chrome.runtime.onInstalled.addListener(() => {
   chrome.contextMenus.create({
      id: "getSummary",
      title: "Obtener resumen",
      contexts: ["link"],
   });
});

// API Key hardcodeada directamente
const apiKey = "";

// Escuchar cuando el usuario selecciona "Obtener resumen"
chrome.contextMenus.onClicked.addListener((info, tab) => {
   if (info.menuItemId === "getSummary") {
      const url = info.linkUrl;
      console.log("URL capturada: ", url);

      chrome.scripting.executeScript(
         {
            target: { tabId: tab.id },
            function: fetchArticleBodyFromUrl,
            args: [url],
         },
         (results) => {
            if (chrome.runtime.lastError) {
               console.error(
                  "Error ejecutando script: ",
                  chrome.runtime.lastError.message
               );
               return;
            }

            const articleBody = results[0].result;
            console.log("Cuerpo del artículo obtenido: ", articleBody);

            if (
               !articleBody ||
               articleBody === "No se encontró el cuerpo del artículo."
            ) {
               console.error(
                  "Error: No se pudo obtener el cuerpo del artículo."
               );
               return;
            }

            const shortenedArticle =
               articleBody.length > 2000
                  ? articleBody.substring(0, 2000)
                  : articleBody;
            console.log("Artículo acortado para el prompt: ", shortenedArticle);

            // Ahora, hacemos la solicitud a OpenAI usando el modelo actualizado
            console.log(
               "A punto de hacer la solicitud a OpenAI con el artículo y la API Key..."
            );

            fetch("https://api.openai.com/v1/chat/completions", {
               method: "POST",
               headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${apiKey}`,
               },
               body: JSON.stringify({
                  model: "gpt-4", // Usamos el modelo gpt-4
                  messages: [
                     {
                        role: "system",
                        content:
                           "You are a helpful assistant that summarizes news articles.",
                     },
                     {
                        role: "user",
                        content: `Resumí los puntos clave de este artículo en un párrafo breve: ${shortenedArticle}`,
                     },
                  ],
                  max_tokens: 150,
               }),
            })
               .then((response) => {
                  console.log(
                     "Estado de la respuesta de OpenAI:",
                     response.status
                  );

                  if (!response.ok) {
                     console.log(
                        "Error en la respuesta, estado:",
                        response.status,
                        response.statusText
                     );
                     return response.text().then((text) => {
                        console.log(
                           "Cuerpo completo de la respuesta de error:",
                           text
                        );
                        throw new Error(
                           `Error en la respuesta de OpenAI: ${response.statusText}`
                        );
                     });
                  }
                  return response.json();
               })
               .then((data) => {
                  console.log("Respuesta completa de OpenAI: ", data);

                  if (data.choices && data.choices.length > 0) {
                     const summary = data.choices[0].message.content;
                     console.log("Resumen obtenido: ", summary);

                     chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        function: showSummary,
                        args: [summary],
                     });
                  } else {
                     console.error(
                        "No se encontró el resumen en la respuesta de OpenAI."
                     );
                  }
               })
               .catch((error) => {
                  console.error(
                     "Error al obtener el resumen de OpenAI:",
                     error
                  );
               });
         }
      );
   }
});

// Función para extraer el cuerpo del artículo desde el JSON-LD
function fetchArticleBodyFromUrl(url) {
   return fetch(url)
      .then((response) => response.text())
      .then((html) => {
         const parser = new DOMParser();
         const doc = parser.parseFromString(html, "text/html");

         // Buscar el script type="application/ld+json"
         const jsonLd = doc.querySelector('script[type="application/ld+json"]');

         if (jsonLd) {
            const json = JSON.parse(jsonLd.innerHTML);
            const article = Array.isArray(json)
               ? json.find((item) => item.articleBody)
               : json;
            return article
               ? article.articleBody
               : "No se encontró el cuerpo del artículo.";
         }

         return "No se encontró el script con el JSON-LD.";
      })
      .catch((error) => {
         console.error("Error al obtener el cuerpo del artículo:", error);
         return "Error al obtener el cuerpo del artículo.";
      });
}

// Función para mostrar el resumen en la página
function showSummary(summary) {
   console.log("Creando el pop-up con el resumen:", summary); // Para depuración

   // Crear el contenedor del pop-up
   const div = document.createElement("div");
   div.style.position = "fixed";
   div.style.top = "50%";
   div.style.left = "50%";
   div.style.transform = "translate(-50%, -50%)"; // Centramos el pop-up
   div.style.padding = "20px";
   div.style.backgroundColor = "#f8f9fa";
   div.style.border = "1px solid #ccc";
   div.style.zIndex = 10000; // Asegurarnos de que esté por encima de otros elementos
   div.style.maxWidth = "400px"; // Limitar el ancho
   div.style.maxHeight = "300px"; // Limitar el alto
   div.style.overflowY = "auto"; // Hacer scroll si el contenido es muy largo
   div.style.boxShadow = "0px 4px 6px rgba(0, 0, 0, 0.1)"; // Añadir sombra para darle estilo

   // Añadir el resumen dentro del pop-up
   const summaryText = document.createElement("p");
   summaryText.innerText = summary;
   summaryText.style.marginBottom = "20px"; // Espacio entre el texto y el botón
   div.appendChild(summaryText);

   // Crear el botón de cierre
   const closeButton = document.createElement("button");
   closeButton.innerText = "Cerrar";
   closeButton.style.padding = "10px 20px";
   closeButton.style.backgroundColor = "#146EF5";
   closeButton.style.color = "#fff";
   closeButton.style.border = "none";
   closeButton.style.cursor = "pointer";
   closeButton.style.borderRadius = "5px";

   // Añadir funcionalidad al botón de cierre
   closeButton.onclick = () => {
      div.remove();
      console.log("Pop-up cerrado manualmente");
   };

   // Añadir el botón al pop-up
   div.appendChild(closeButton);

   // Añadir el pop-up al DOM
   document.body.appendChild(div);
   console.log("Pop-up creado con éxito en el DOM");
}
