const puppeteer = require('puppeteer')
const admin = require('firebase-admin')

// Firebase 설정
const serviceAccount = require('./serviceAccountKey.json')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mlb-management-default-rtdb.firebaseio.com"
})
const db = admin.database()


const bandScrappingBirth = async () => {
  try {
    const browser = await puppeteer.launch({
      // headless : 'new'
      headless : false
      // headless: true
    })

    const page = await browser.newPage()
    const loginPage = 'https://auth.band.us/login_page?next_url=https%3A%2F%2Fband.us%2Fhome%3Freferrer%3Dhttps%253A%252F%252Fband.us%252F'
    // 네이버 밴드 사이트 로그인 페이지로 이동하기!
    await page.goto(loginPage)
    console.log('Navigated to login page.')
    // const ID = 'kinhyeonjin@naver.com'
    // const PW = 'theisland4!'
    // await page.click('#login_list > li:nth-child(4) > a')
    
    // const emailSelector = "div#loginform #email_container input[name='email']"
    // // const emailSelector = "#input_email"
    // const passSelector = "div#loginform div.clearfix._5466._44mg input[name='pass']"
    // // const passSelector = "#pw"
    // await page.waitForSelector(emailSelector,  { timeout: 60000 })
    // await page.type(emailSelector, ID)
    // await page.type(passSelector, PW)
    // await page.keyboard.press('Enter')
    // await page.waitForNavigation({ waitUntil: 'networkidle0' })
  
    // 로그인 처리
    await page.waitForSelector('#content > section > div.homeMyBandList.gMat20.gPab35._myBandListWrap > div > ul > li:nth-child(2)', { visible: true, timeout: 100000 })
  
    console.log('로그인 성공')

    // 멤버 페이지로 이동
    await Promise.all([
      page.waitForNavigation(),
      page.goto('https://band.us/band/77309128/member')
    ])
    console.log('Navigated to member page.')

    await page.waitForSelector('#content > div > div.memberWrap > div._memberListWrap > div > ul > li:nth-child(1) > a')

    const memberLinkButton = (param) => {
      return `#content > div > div.memberWrap > div._memberListWrap > div > ul > li:nth-child(${param}) > a`
    }

    const membersLength = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(`#content > div > div.memberWrap > div._memberListWrap > div > ul > li`)).length
    })
    
    //생일 selector
    const nameSelector = `#wrap > div.layerContainerView > div > div > div > div > div > div.userInfo.gPal25.gPar25.gPat15.gPab38 > h1`
    const birthSelector = `#wrap > div.layerContainerView > div > div > div > div > div > div.userInfo.gPal25.gPar25.gPat15.gPab38 > p > span`

    const birthUser = {}

    for(let i = 1; i <= membersLength; i++){
      await page.click(memberLinkButton(i))
      try {
        await page.waitForSelector(birthSelector, { timeout: 1000 }) 
      } catch (error) {
        console.log('생일이 없엉...')
        await page.keyboard.press('Escape')
        continue // 해당 요소가 발견되지 않으면 다음 반복으로 건너뜀
      }


      const name = await page.evaluate((nameSelector) => {
        const element = document.querySelector(nameSelector)
        return element ? element.textContent : null
      }, nameSelector)

      const birth = await page.evaluate((birthSelector) => {
        const element = document.querySelector(birthSelector)
        return element ? element.textContent : null
      }, birthSelector)

      const birthText = birth.replace('생일 ', '').padStart(2,'0')
      birthUser[name] = birthText

      // 다 했으면 모달 닫기
      await page.keyboard.press('Escape')
    }
  console.log('크롤링 완료')
  
  // 파이어베이스에 결과를 저장
  const memberList = await db.ref('memberList').get()
  const memberListData = memberList.val()
  let modifiedMemberList = memberListData

  for (let [id, userObj] of Object.entries(memberListData)){
    const currentUserData = birthUser[userObj.name]
    if (!currentUserData) { // users[userObj.name]이 존재하지 않는지 확인 (현재 남아있는 회원인지)
      continue // 현재 반복 건너뛰고 다음 반복으로 넘어감
    }
    if (!modifiedMemberList[id]) {
      modifiedMemberList[id] = {}
    }
    modifiedMemberList[id][`birth`] = currentUserData
  }

  // 수정된 데이터를 Firebase에 다시 저장
  await db.ref('memberList').update(modifiedMemberList)
  // 백업 보관
  await db.ref('backup').update(memberListData)
  console.log('Data processed and updated in Firebase.')

  }catch(error){
    console.error('An error occurred:', error)
    const ref = db.ref(`error`)
    await ref.set(error)
  }
}

bandScrappingBirth()