const puppeteer = require('puppeteer')
const admin = require('firebase-admin')

// Firebase 설정
const serviceAccount = require('./serviceAccountKey.json')
const { schedule } = require('node-cron')
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mlb-management-default-rtdb.firebaseio.com"
})
const db = admin.database()


const bandScrapping = async () => {
  try{
  const browser = await puppeteer.launch({
    // headless : 'new'
    headless : false
    // headless: true
  })

  const page = await browser.newPage()
  // const loginPage = 'https://auth.band.us/login_page?next_url=https%3A%2F%2Fband.us%2Fhome%3Freferrer%3Dhttps%253A%252F%252Fband.us%252F'
  const loginPage = 'https://auth.band.us/email_login?keep_login=false'

  // // 네이버 밴드 사이트 로그인 페이지로 이동하기!
  await page.goto(loginPage)
  console.log('Navigated to login page.')
  const ID = 'kinhyeonjin@naver.com'
  const PW = 'Theisland4!'
  // await page.click('#login_list > li:nth-child(4) > a')
  
  // const emailSelector = "div#loginform #email_container input[name='email']"
  const emailSelector = "#input_email"
  // const passSelector = "div#loginform div.clearfix._5466._44mg input[name='pass']"
  const passSelector = "#pw"
  // await page.waitForSelector(emailSelector,  { timeout: 60000 })
  await page.type(emailSelector, ID)
  await page.keyboard.press('Enter')
  await page.waitForSelector(passSelector,  { timeout: 60000 })
  await page.type(passSelector, PW)
  await page.keyboard.press('Enter')
  // await page.waitForNavigation({ waitUntil: 'networkidle0' })

  // 로그인 처리
  await page.waitForSelector('#content > section > div.homeMyBandList.gMat20.gPab35._myBandListWrap > div > ul > li:nth-child(2)', { visible: true, timeout: 100000 })

  console.log('로그인 성공')

  // 일정 페이지로 이동
  await Promise.all([
    page.waitForNavigation(),
    page.goto('https://band.us/band/77309128/calendar')
    // page.goto('https://band.us/band/67914069/calendar?currentDate=2019-09')
  ])
  console.log('Navigated to calendar page.')

  //이번달 확인
  const date = new Date()
  let month = date.getMonth() + 1

  //전체 데이터
  let totalMeetData = {

  }

  //월간 반복
  // for(month; month >= 1; month--){
  
  await page.waitForSelector('#content > section > div.scheduleList.gContentCardShadow > ul > li > span > a')
  const modals = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('#content > section > div.scheduleList.gContentCardShadow > ul > li'))
    return anchors.length
  })
  console.log(`Found ${modals} schedules.`)

  //우리가 원하는 그것!!
  let meetData = []
  let opportunity = {}

  //참석자
  const dataTarget = '#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleMain > div.scheduleRsvpArea > ul > li:nth-child(1) > label:nth-child(2) > span > span'

  //벙주
  const dataTargetHost = '#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleHead._scheduleHead > div.contWrap > div > span.hostName'

  //벙의 종류
  const targetType = '#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleHead._scheduleHead > div.contWrap > div > span.calendarName'

  //벙 이름
  const targetName = `#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleHead._scheduleHead > div.contWrap > h2`

  //벙 열린 날짜
  const targetDate = '#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleHead._scheduleHead > div.contWrap > time'

  const yearMonth = '#content > section > div.calendarViewWrap.gContentCardShadow > div:nth-child(1) > div.calendarHeader > div.month > strong'
  await page.waitForSelector(yearMonth)
  const handleYM = await page.evaluate((yearMonth) => {
    const element = document.querySelector(yearMonth)
    return element.textContent.split(' ')
  }, yearMonth)

  let targetYear = handleYM[0].replace('년', '')
  let targetMonth = handleYM[1].replace('월', '')

  // 각 일정 모달을 열어서 참가자 명단을 크롤링
  for(let i = 1; i <= modals; i++) {

    //벙 링크
    const targetLink = `#content > section > div.scheduleList.gContentCardShadow > ul > li:nth-child(${i}) > span > a`

    //동일 날짜에 벙이 둘 이상 개설될 경우를 대비한 같은 날짜 벙 갯수 확인 코드
    const targetLinkAll = await page.evaluate((targetLink) => {
      const result = document.querySelectorAll(targetLink)
      return result.length
    }, targetLink)

    //동일 날짜에 벙이 둘 이상 개설될 경우를 대비한 반복문
    for(let j = 1; j <= targetLinkAll; j++){

      await page.click(`#content > section > div.scheduleList.gContentCardShadow > ul > li:nth-child(${i}) > span > a:nth-child(${j})`)



      try {
        await page.waitForSelector(dataTarget, { timeout: 1000 }) // timeout 옵션을 추가하여 짧은 시간 내에 찾지 못하면 넘어감
        await page.waitForSelector(dataTargetHost, { timeout: 1000 }) // timeout 옵션을 추가하여 짧은 시간 내에 찾지 못하면 넘어감
      } catch (error) {      
        console.log('dataTarget not found, skipping')
        await page.keyboard.press('Escape')
        continue // 못찾으면 건너뜀
      } 
      
      //벙 카운트 추가
      opportunity[i] = (opportunity[i] || 0 ) + 1

      //벙 정보 찾기
      const meet = await page.evaluate((dataTargetHost, targetName, targetType, targetDate) => {
        const checkTitle = document.querySelector(targetName)
        const checkHost = document.querySelector(dataTargetHost)
        const checkType = document.querySelector(targetType)
        const checkDate = document.querySelector(targetDate)
        const result = {
          title: checkTitle.textContent,
          host: checkHost.textContent,
          date: checkDate.textContent,
          type: checkType.textContent
        }
        return checkTitle ? result : null
      }, dataTargetHost, targetName, targetType, targetDate)

      //참석자 찾기
      let names = ''
      for(let k = 1; k <= 10; k++){

        const namesFind = await page.evaluate((k) => {

          //참석자 
          const getDataTarget = (i) => `#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleMain > div.scheduleRsvpArea > ul > li:nth-child(${i}) > label:nth-child(2) > span > span`

          //투표 타입(참석, 불참석, 미정, 게스트 등등)
          const dataTargetType = (i) => `#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleMain > div.scheduleRsvpArea > ul > li:nth-child(${i}) > label:nth-child(2) > span > strong`
          const elementType = document.querySelector(dataTargetType(k))
          if(
            !elementType || 
            elementType.textContent === '불참석' ||
            elementType.textContent === '참석 대기' || 
            elementType.textContent === '미정'
          ){
            return null
          }
          const element = document.querySelector(getDataTarget(k))
          return element.textContent ? element.textContent : null
        }, k)

        console.log(namesFind)
        if (namesFind) {
          if (names) {
              names += ", "
          }
          names += namesFind
        }
      }
      if(names) {
        if(meet) meet.list = names
      }

      meetData = meet ? meetData.concat(meet) : meetData
      // 모달 닫기
      await page.keyboard.press('Escape')
      console.log(`${i}번째 일정 끝`)

    } 
  }

  totalMeetData[targetYear] = totalMeetData[targetYear] || {}
  totalMeetData[targetYear][targetMonth] = meetData

  //아래쪽은 월간 반복을 위한 코드
//   participants = [] // 다음 일정을 위해 참가자 배열 초기화
//   await page.click(`#content > section > div.calendarViewWrap.gContentCardShadow > div:nth-child(1) > div.calendarHeader > div.month > button.prev._btnPrev`)
//  }//월간 반복


  // 파이어베이스에 결과를 저장
  const meet = await db.ref(`meetData/${date.getFullYear()}`).get()
  const meetDB = meet.val()
  const updateData = {...meetDB, ...totalMeetData[date.getFullYear()]}

  const refMeet = db.ref(`meetData/${date.getFullYear()}`)
  await refMeet.update(updateData)
  console.log(`크롤링 끄읕`)
  //데이터 가공
  await processFirebaseData()

  //생일 찾기
  // await bandScrappingBirth(page)
  } catch (error) {
    console.error('An error occurred:', error)
    const ref = db.ref(`error`)
    await ref.set(error)
  }

  //브라우저 닫기
}


//백업 복원
async function backUp () {
  try {
    const backup = await db.ref('backup').get()
    const backupData = backup.val()
    await db.ref('memberList').update(backupData)
    console.log('백업복구했당..')
  } catch {
    console.log('흐엥 안됐당..')
  }
}
/*
async function bandScrappingBirth (page) {
  try {

    console.log('생일 스크래핑 시작..')

    //생일 이름
    const targetName = `#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleHead._scheduleHead > div.contWrap > h2`

    //생일 열린 날짜
    const targetDate = '#wrap > div.layerContainerView > div > section > div > div:nth-child(1) > div > div > div.scheduleHead._scheduleHead > div.contWrap > time'

    //생일 데이터 저장 객체
    let birthUser = {}
 
    //월간 반복
    for(let i = 1; i <= 12; i++){
      const modals = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('#content > section > div.scheduleList.gContentCardShadow > ul > li'))
        return anchors.length
      })
      console.log(`Found ${modals} schedules.`)

    // 각 일정 모달을 열어서 생일 명단을 크롤링
    for(let i = 1; i <= modals; i++) {

      //벙 링크
      const targetLink = `#content > section > div.scheduleList.gContentCardShadow > ul > li:nth-child(${i}) > span > a`

      //동일 날짜에 벙이 둘 이상 개설될 경우를 대비한 같은 날짜 벙 갯수 확인 코드
      const targetLinkAll = await page.evaluate((targetLink) => {
        const result = document.querySelectorAll(targetLink)
        return result.length
      }, targetLink)

      for(let j = 1; j <= targetLinkAll; j++){
        await page.click(`#content > section > div.scheduleList.gContentCardShadow > ul > li:nth-child(${i}) > span > a:nth-child(${j})`)
        console.log('리스트 클릭할 단계')

        try {
          await page.waitForSelector(targetName, { timeout: 500 })
        } catch(e){
          console.log('dataTarget not found, skipping')
          await page.keyboard.press('Escape')
          continue // 못찾으면 건너뜀
        }

        console.log('생일 정보 확인')
        //생일 정보 찾기
        const birth = await page.evaluate((targetName, targetDate) => {
          const checkName = document.querySelector(targetName)
          const checkDate = document.querySelector(targetDate)
          if(checkName.textContent.includes('생일')){
            const result = {
              name: checkName.textContent.replace(` 생일`, ''),
              date: checkDate.textContent,
            }
            return result
          }
          return null
        }, targetName, targetDate)

        //생일이면 저장
        if(birth){
          birthUser[birth.name] = birth.date
          console.log('생일찾았당')
        }

        // 모달 닫기
        await page.keyboard.press('Escape')
      }
    } //모달 반복문
    await page.click(`#content > section > div.calendarViewWrap.gContentCardShadow > div:nth-child(1) > div.calendarHeader > div.month > button.next._btnNext`)
  }//월간 반복
  console.log('생일크롤링 완료')
  
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
*/

//데이터 가공
async function processFirebaseData () {
  try {
    // Firebase에서 데이터 가져오기
    const memberList = await db.ref('memberList').get()
    const meet = await db.ref('meetData').get()
    const halloffame = await db.ref('halloffame').get()
    const memberListData = memberList.val()
    const meetData = meet.val()
    const hofData = halloffame.val()
    

    let modifiedMemberList = memberListData

    let userList = {}

    // 이번달 확인
    const date = new Date()
    const currentYear = date.getFullYear();
    const currentMonth = date.getMonth() + 1;
    [2017, 2018, 2019, 2020, 2021, 2022, 2023].forEach(year => {
      Object.entries(meetData[year]).forEach((monthData) => {
        monthData[1].forEach(schedule => {
          //참석자 확인
          if(schedule.list){(schedule.list).split(',').forEach((name) => {
            let trimname = name.trim()
            userList[trimname] = userList[trimname] || {}
            userList[trimname]['attend'] = userList[trimname]['attend'] || {}
            userList[trimname]['attend'][year] = userList[trimname]['attend'][year] || {}
            userList[trimname]['attend'][year][monthData[0]] = (userList[trimname]['attend'][year][monthData[0]] || 0) + 1
          })
          }
          //개설자 확인(정모나 운영진회의이면 개인 벙 개설 기록에서 제외)
          if(schedule.type !== '정모' && schedule.type !== '운영진회의'){
            let hostName = schedule.host
            userList[hostName] = userList[hostName] || {}
            userList[hostName]['host'] = userList[hostName]['host'] || {}
            userList[hostName]['host'][year] = userList[hostName]['host'][year] || {}
            userList[hostName]['host'][year][monthData[0]] = (userList[hostName]['host'][year][monthData[0]] || 0) + 1
          }

        })
      })
    })

    //이번달 참여기록 초기화
    Object.values(modifiedMemberList).forEach(member => {
      if (member && member.attend && member.attend[currentYear]) {
        member.attend[currentYear][currentMonth] = 0
      }
      if (member && member.host && member.host[currentYear]) {
        member.host[currentYear][currentMonth] = 0
      }
    })

    for(let [id, userObj] of Object.entries(modifiedMemberList)){
      const currentUser = userList[userObj.name]
      if(!currentUser){
        //크롤링 데이터가 존재하는지? 없으면 넘어감.
        continue
      }
      
      //참여기록 추가
      if(userList[userObj.name].attend){
        modifiedMemberList[id].attend = userList[userObj.name].attend
      }

      //호스트기록 추가
      if(userList[userObj.name].host){
        modifiedMemberList[id].host = userList[userObj.name].host
      }
    }

    






    
    // // 데이터 가공 및 수정 작업
    // // let factoring = [{},{},{},{},{},{},{},{},{},{},{},{}]
    // let factoring = {
    //   2023 : {
    //     1 : {
    //       '김현진': 3,
    //       '박선영': 4,
    //     }
    //   }
    // }
    // // let factoringHost = [{},{},{},{},{},{},{},{},{},{},{},{}]
    // let factoringHost = {

    // }
    // let users = {
    //   '김현진': {
    //     2023: {
    //       1: 4,
    //       2: 3,
    //       3: 2
    //     }
    //   }
    // }
    // let usersHost = {}

    // //1차 가공 - 월별로 정리

    // //벙 참석 및 개설 확인
    // Object.values(meetData).forEach((year) => {

    // year.forEach((schedule, i) => {

    //   schedule.forEach((list) => {

    //     //참석자 확인
    //     list['list'].split(',').forEach((name) => {
    //       let trimname = name.trim()
    //       factoring[i][trimname] = (factoring[i][trimname] || 0) + 1
    //     })

    //     //정모나 운영진회의이면 개인 벙 개설 기록에서 제외
    //     if(list.type !== '정모' && list.type !== '운영진회의'){
    //       console.log(list.type)
    //       factoringHost[i][list.host] = (factoringHost[i][list.host] || 0) + 1
    //     }
    //   })

    // })
    // })

    // //2차 가공 - 유저별로 정리
    // //벙 참석
    // factoring.forEach((month, i) => {
    //   Object.entries(month).forEach(([name, count]) => {
    //     if (!users[name]) {
    //       users[name] = {}
    //     }
    //     users[name][(i+1) + 'month'] = count
    //     users[name]['total'] = (users[name]['total'] || 0 ) + count
    //   })
    // })
    // //벙 개설
    // factoringHost.forEach((month, i) => {
    //   Object.entries(month).forEach(([name, count]) => {
    //     if (!usersHost[name]) {
    //       usersHost[name] = {}
    //     }
    //     usersHost[name][(i+1) + 'month'] = count
    //     usersHost[name]['total'] = (usersHost[name]['total'] || 0 ) + count
    //   })
    // })

    // // 이번달 확인
    // const date = new Date()
    // const currentYear = date.getFullYear()
    // const currentMonth = date.getMonth() + 1
    
    // //이번달 기존 참여기록 초기화
    // Object.values(modifiedMemberList).forEach(member => {
    //   member[`${currentMonth}month`] = 0
    // })


    // //최종 데이터 바인딩
    //hof 정보 가공
    function parseText(input) {
      // Remove all text within parentheses
      const noParentheses = input.replace(/\(.*?\)/g, '')
    
      // Split by comma or ampersand, trimming any extra whitespace
      const segments = noParentheses.split(/\s*[,&]\s*/)
    
      return segments
    }
    
    let userHof = {}

    Object.values(hofData).forEach(award => {
      if(award.fClass){
        parseText(award.fClass).forEach(name => {
          if(!userHof[name]){
            userHof[name] = {}
          }
    
          if(!userHof[name]['fClass']){
            userHof[name]['fClass'] = 0
          }
    
          userHof[name]['fClass'] += 1
        })
      }

      ['sClass', 'tClass', 'anotherClass'].forEach(classType => {
        if(award[classType]){
          parseText(award[classType]).forEach(name => {
            if(!userHof[name]){
              userHof[name] = {}
            }
            
            if(!userHof[name]['sClass']){
              userHof[name]['sClass'] = 0
            }

            userHof[name]['sClass'] += 1
          })
        }
      })
    })
    // //벙 참여
    // for (let [id, userObj] of Object.entries(memberListData)){
    //   const currentUserData = users[userObj.name]
    //   if (!currentUserData) { // users[userObj.name]이 존재하지 않는지 확인 (현재 남아있는 회원인지)
    //     continue; // 현재 반복 건너뛰고 다음 반복으로 넘어감
    //   }
      
    //   for(let [month, count] of Object.entries(currentUserData)) {
    //     if (!modifiedMemberList[id]) {
    //       modifiedMemberList[id] = {}
    //     }
    //     modifiedMemberList[id][month] = count
    //   }
    //   if(!modifiedMemberList[id][`${currentMonth}month`] && !modifiedMemberList[id][`${currentMonth - 1}month`]){
    //     if(modifiedMemberList[id]['comeback']){
    //       const comeDate = new Date(modifiedMemberList[id]['comeback'])
    //       const comeYear = comeDate.getFullYear()
    //       const comeMonth = comeDate.getMonth() + 1
    //       if(currentYear === comeYear &&
    //         (comeMonth === currentMonth || comeMonth + 1 === currentMonth)
    //       ){
    //         modifiedMemberList[id]['danger'] = false 
    //       }else{
    //         modifiedMemberList[id]['danger'] = true 
    //       }
    //     }
    //   }else{
    //     modifiedMemberList[id]['danger'] = false
    //   }
    // }

    // //벙 개설
    // for (let [id, userObj] of Object.entries(memberListData)){
    //   const currentUserData = usersHost[userObj.name]
    //   if (!currentUserData) { // users[userObj.name]이 존재하지 않는지 확인 (현재 남아있는 회원인지)
    //     continue // 현재 반복 건너뛰고 다음 반복으로 넘어감
    //   }
      
    //   for(let [month, count] of Object.entries(currentUserData)) {
    //     if (!modifiedMemberList[id]) {
    //       modifiedMemberList[id] = {}
    //     }
    //     modifiedMemberList[id][`${month}Host`] = count
    //   }
    // }

    //hof정보 갱신
    for (let [id, userObj] of Object.entries(memberListData)){
      const currentUserData = userHof[userObj.name]
      if (!currentUserData) { // users[userObj.name]이 존재하지 않는지 확인 (현재 남아있는 회원인지)
        continue // 현재 반복 건너뛰고 다음 반복으로 넘어감
      }
      modifiedMemberList[id][`awardCount`] = currentUserData
    }

    // 수정된 데이터를 Firebase에 다시 저장
    await db.ref('memberList').update(modifiedMemberList)
    // 백업 보관
    await db.ref('backup').update(memberListData)
    console.log('Data processed and updated in Firebase.')
  } catch (error) {
    console.error('An error occurred:', error)
  }
}
// backUp()
bandScrapping()
// processFirebaseData()