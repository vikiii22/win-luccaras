; (() => {
  const DICCIONARIO_BASE = { /*add your dictionary*/  }
  const STORAGE_KEY = 'lucca_faces_data_v1'
  let people = {
    ...DICCIONARIO_BASE,
    ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {})
  }
  let currentImageHash = ''
  let retryAttempts = 0
  let discoveredNew = 0
  const MAX_RETRY_ATTEMPTS = 5
  let questionsAnswered = 0
  let currentTotalScore = 0
  let accumulatedDifference = 0
  let timePerQuestion = 0

  // Configuración automática
  const scorecible = 1500

  function approxValue(x) {
    const xData = [1000000,
      1670,
      1550,
      1500,
      1360,
      1205,
      1135,
      1075,
      1025,
      975,
      940,
      900,
      870,
      835,
      805,
      640,
      555,
      500,
      450,
      400,
      350,
      300,
      250,
      200,
      150,
      100,
      50,
      0]
    const yData = [0,
      0,
      40,
      60,
      200,
      400,
      500,
      600,
      700,
      800,
      900,
      1000,
      1100,
      1200,
      1300,
      2000,
      2500,
      3000,
      3500,
      4000,
      4500,
      5000,
      5500,
      6000,
      6500,
      7000,
      7500,
      8000]

    if (x >= xData[0]) return yData[0]
    if (x <= xData[xData.length - 1]) return yData[yData.length - 1]

    for (let i = 1; i < xData.length; i++) {
      if (x <= xData[i - 1] && x >= xData[i]) {
        const x0 = xData[i]
        const x1 = xData[i - 1]
        const y0 = yData[i]
        const y1 = yData[i - 1]
        return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
      }
    }
    return null
  }

  timePerQuestion = approxValue(scorecible)

  function getPointsFromSpanText(spanText) {
    const regex = /\+ (\d+) pts/
    const match = spanText.match(regex)
    return match && match.length > 1 ? parseInt(match[1],
      10) : 0
  }

  function getImageHash(imageSrc) {
    return new Promise((resolve,
      reject) => {
      const img = new Image()
      img.crossOrigin = 'Anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img,
          0,
          0)
        canvas.toBlob((blob) => {
          const reader = new FileReader()
          reader.onloadend = () => {
            crypto.subtle.digest('SHA-256',
              reader.result).then((hashBuffer) => {
                const hashArray = Array.from(new Uint8Array(hashBuffer))
                const hashHex = hashArray.map((b) => b.toString(16).padStart(2,
                  '0')).join('')
                resolve(hashHex)
              })
          }
          reader.onerror = reject
          reader.readAsArrayBuffer(blob)
        })
      }
      img.onerror = reject
      img.src = imageSrc
    })
  }

  function gameCompleted() {
    console.log('%c--- Partida Finalizada ---',
      'color: #00ff00; font-weight: bold;')
    if (discoveredNew === 0) {
      console.log(`Puntuación total: ${currentTotalScore}. Diferencia: ${accumulatedDifference}pts.`)
    } else {
      console.log(`Has descubierto ${discoveredNew} personas nuevas en esta ronda.`)
      console.log(`Reiniciando para alcanzar el objetivo de ${scorecible}pts...`)
    }
    // El intervalo de main() se encargará de reiniciar
  }

  function handleNewImage(imageSrc) {
    getImageHash(imageSrc)
      .then((hashHex) => {
        if (hashHex !== currentImageHash) {
          currentImageHash = hashHex
          if (people[currentImageHash]) {
            ensureChoicesLoaded()
              .then((choices) => {
                const correctAnswer = [...choices].find((choice) => choice.textContent.trim() === people[currentImageHash].trim())
                if (correctAnswer) {
                  console.log(`Persona conocida: ${people[currentImageHash]}. Clic en ${timePerQuestion.toFixed(0)}ms...`)
                  setTimeout(() => {
                    correctAnswer.click()
                    pollForScoreElement((pointsEarned) => {
                      questionsAnswered++
                      currentTotalScore += pointsEarned

                      const questionsRemaining = 10 - questionsAnswered
                      accumulatedDifference = scorecible - currentTotalScore
                      const scoreNeededNext = questionsRemaining > 0 ? Math.ceil(accumulatedDifference / questionsRemaining) : 0
                      const newDelay = approxValue(scoreNeededNext * 10)

                      console.log(`${questionsAnswered}/10: ${people[currentImageHash]} (+${pointsEarned}pts). Total: ${currentTotalScore}`)

                      if (timePerQuestion !== newDelay && questionsAnswered < 10 && discoveredNew === 0) {
                        console.log(`  --> Adaptando tiempo. Siguiente pregunta: ${newDelay.toFixed(1)}ms`)
                        timePerQuestion = newDelay
                      }

                      if (questionsAnswered < 10) {
                        setTimeout(() => {
                          const newImageElement = document.querySelector('#game app-timer .image')
                          if (newImageElement) {
                            const newSrc = newImageElement.style.backgroundImage.match(/url\("(.*)"\)/)[1]
                            handleNewImage(newSrc)
                          }
                        },
                          newDelay)
                      } else {
                        gameCompleted()
                      }
                    })
                  },
                    timePerQuestion)
                } else {
                  console.warn('No se encontró el botón con el nombre guardado. Probando suerte...')
                  chooseRandomAnswer()
                }
              })
              .catch(() => console.error('Error: No se pudieron cargar las opciones.'))
          } else {
            console.log('%cNueva persona detectada. Aprendiendo...',
              'color: #3498db')
            discoveredNew++
            chooseRandomAnswer()
          }
        }
        retryAttempts = 0
      })
      .catch((error) => {
        if (questionsAnswered < 10 && retryAttempts < MAX_RETRY_ATTEMPTS) {
          retryAttempts++
          setTimeout(() => handleNewImage(imageSrc),
            100)
        }
      })
  }

  function pollForScoreElement(callback) {
    const interval = setInterval(() => {
      const scoreSpan = document.querySelector('.image-container .image-overlay span.score')
      if (scoreSpan) {
        clearInterval(interval)
        callback(getPointsFromSpanText(scoreSpan.textContent))
      }
    },
      100)
  }

  function chooseRandomAnswer() {
    ensureChoicesLoaded()
      .then((choices) => {
        const randomChoice = choices[Math.floor(Math.random() * choices.length)]
        const randomTime = 800
        setTimeout(() => randomChoice.click(),
          randomTime)
        setTimeout(() => {
          const correctAnswer = document.querySelector('#game .answers .is-right')
          if (correctAnswer) {
            const name = correctAnswer.textContent.trim()
            people[currentImageHash] = name
            localStorage.setItem(STORAGE_KEY,
              JSON.stringify(people))
            questionsAnswered++
            console.log(`%cAPRENDIDO: ${name}`,
              'color: #f1c40f')
          }
          if (questionsAnswered === 10) gameCompleted()
        },
          600 + randomTime)
      })
  }

  function ensureChoicesLoaded(retries = 5,
    delay = 100) {
    return new Promise((resolve,
      reject) => {
      const check = (attempts) => {
        const choices = document.querySelectorAll('#game .answers .answer')
        if (choices.length > 0) resolve(choices)
        else if (attempts > 0) setTimeout(() => check(attempts - 1),
          delay)
        else reject()
      }
      check(retries)
    })
  }

  function startGame() {
    const goButton = document.querySelector('button.rotation-loader')
    if (goButton) {
      console.log('Iniciando juego...')
      const observer = new MutationObserver(() => {
        if (document.querySelector('#game')) {
          observer.disconnect()
          setupGameObserver()
        }
      })
      observer.observe(document.body,
        {
          childList: true,
          subtree: true
        })
      goButton.click()
    }
  }

  function restartGame() {
    // Busca el botón de rejugas (funciona en varios idiomas)
    const replayButton = Array.from(document.querySelectorAll('button.button'))
      .find(b => b.textContent.includes('Repetir') || b.textContent.includes('Rejugar') || b.textContent.includes('Play again'))

    if (replayButton) {
      console.log('Reiniciando automáticamente...')
      replayButton.click()

      setTimeout(() => {
        const goButton = document.querySelector('button.rotation-loader')
        if (goButton) {
          questionsAnswered = 0
          currentTotalScore = 0
          accumulatedDifference = 0
          discoveredNew = 0
          currentImageHash = ''

          const observer = new MutationObserver(() => {
            if (document.querySelector('#game')) {
              observer.disconnect()
              setupGameObserver()
            }
          })
          observer.observe(document.body,
            {
              childList: true,
              subtree: true
            })
          goButton.click()
        }
      },
        1500)
    }
  }

  let gameObserver = null
  function setupGameObserver() {
    if (gameObserver) gameObserver.disconnect()
    const gameElement = document.querySelector('#game')
    if (!gameElement) return

    gameObserver = new MutationObserver(() => {
      const img = document.querySelector('#game app-timer .image')
      if (img && img.style.backgroundImage) {
        const src = img.style.backgroundImage.match(/url\("(.*)"\)/)[1]
        handleNewImage(src)
      }
    })
    gameObserver.observe(gameElement,
      {
        childList: true,
        subtree: true
      })

    const initialImg = document.querySelector('#game app-timer .image')
    if (initialImg && initialImg.style.backgroundImage) {
      handleNewImage(initialImg.style.backgroundImage.match(/url\("(.*)"\)/)[1])
    }
  }

  function main() {
    const goButton = document.querySelector('button.rotation-loader')
    if (!goButton) {
      alert("Error: Debes estar en la pantalla de 'Go! A jugar' para activar el script.")
      return
    }

    console.log(`%cScript Activado - Objetivo: ${scorecible}pts`,
      'background: #222; color: #bada55; font-size: 1.2em; padding: 5px;')
    startGame()
    // Bucle para intentar reiniciar si el juego termina
    setInterval(restartGame,
      2000)
  }

  main()
})()
