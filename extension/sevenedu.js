'use strict';
/**
 * 7Edu: adaptador separado. Nenhum valor de identidade/cookie/token do HAR
 * é usado aqui. Chamadas executadas EXCLUSIVAMENTE na aba 7Edu autenticada,
 * com as credenciais de sessão do próprio navegador, em mesma origem.
 * Nenhuma alteração é feita nos fluxos antigos do E-Class.
 */
const SEVEN_ORIGIN = 'https://7edu-br.educadventista.org';

async function sevenEduTab() {
  const tabs = await chrome.tabs.query({active: true, currentWindow: true});
  const tab = tabs[0];
  if (!tab?.id || !tab.url?.startsWith(`${SEVEN_ORIGIN}/teacherportal/`))
    throw new Error('Abra o 7Edu em https://7edu-br.educadventista.org/teacherportal/ e acesse Aulas Ministradas.');
  const url = new URL(tab.url);
  if (url.pathname !== '/teacherportal/ClassMeeting')
    throw new Error('No 7Edu, abra uma disciplina e depois Aulas Ministradas; mantenha essa aba selecionada.');
  if (!/^[0-9a-f-]{36}$/i.test(url.searchParams.get('employeeId') || ''))
    throw new Error('O endereço de Aulas Ministradas não contém a identificação da sessão docente. Abra a disciplina pelo menu do 7Edu.');
  return tab;
}

async function sevenEduCall(action, post, options = {}) {
  const tab = await sevenEduTab();
  const results = await chrome.scripting.executeScript({
    target: {tabId: tab.id}, world: 'MAIN', func: sevenEduPageOperation,
    args: [{action, post: post || null, options}]
  });
  const result = results?.[0]?.result;
  if (!result || typeof result.ok !== 'boolean')
    throw new Error('O 7Edu não retornou uma resposta válida. Nenhum envio deve ser repetido antes de conferir o diário.');
  if (!result.ok) throw new Error(result.error || 'Falha na integração do 7Edu.');
  return result.data;
}

/**
 * Função autossuficiente: o Chromium a serializa para MAIN world.
 * Nunca expõe cookies ou dados de autenticação à extensão.
 */
async function sevenEduPageOperation(input) {
  try {
    const BASE = 'https://7edu-br.educadventista.org';
    const UUID_ZERO = '00000000-0000-0000-0000-000000000000';
    const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (location.origin !== BASE || location.pathname !== '/teacherportal/ClassMeeting')
      throw new Error('Use a aba original de Aulas Ministradas do 7Edu.');
    const employeeId = new URL(location.href).searchParams.get('employeeId');
    if (!ID.test(employeeId || '')) throw new Error('Identificação de docente inválida na página atual.');
    if (!['status', 'check', 'publish'].includes(input.action)) throw new Error('Operação não autorizada.');
    const safe = (value) => String(value ?? '');
    const norm = (value) => safe(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
    const asIsoDate = (value) => {
      const m = safe(value).match(/^(\d{4})[/-](\d\d)[/-](\d\d)/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
    };
    const asBrDate = (value) => {
      const d = asIsoDate(value);
      return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '';
    };
    const minute = (value) => {
      const m = safe(value).match(/^(\d{1,2}):(\d{2})/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : -10000;
    };
    const today = () => {
      const d = new Date();
      return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    };
    // CORS, domínio e caminho nunca são controlados pelo registro de aulas.
    async function request(path, data, responseType = 'json') {
      const allowed = new Set([
        '/teacherportal/',
        '/teacherportal/Home/GetListOpenedSectionByEmployee',
        '/teacherportal/ClassMeeting',
        '/teacherportal/ClassMeeting/Grid_Read',
        '/teacherportal/ClassMeeting/GetListScheduleTemplateItemByTerm',
        '/teacherportal/ClassMeeting/Save'
      ]);
      const url = new URL(path, BASE);
      if (url.origin !== BASE || !allowed.has(url.pathname)) throw new Error('Rota 7Edu não autorizada.');
      const isSave = url.pathname.endsWith('/Save');
      if (isSave !== (responseType === 'save')) {
        if (isSave) throw new Error('Formato de confirmação inválido para gravação.');
      }
      const headers = {'X-Requested-With': 'XMLHttpRequest', 'Accept': responseType === 'save' ? 'application/json, text/javascript, */*; q=0.01' : '*/*'};
      let body;
      if (data !== undefined && data !== null) {
        if (isSave) {
          headers['Content-Type'] = 'application/json, charset=UTF-8';
          body = JSON.stringify(data);
        } else {
          headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
          const pairs = new URLSearchParams();
          for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) value.forEach(x => pairs.append(key, safe(x)));
            else pairs.append(key, safe(value));
          }
          body = pairs.toString();
        }
      }
      // Sem cross-origin, sem credenciais HAR, sem retry automático de POST.
      const response = await fetch(url.href, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        headers, ...(body === undefined ? {} : {body})
      });
      if (!response.ok) throw new Error(`7Edu respondeu HTTP ${response.status}. Verifique a sessão e as permissões.`);
      const text = await response.text();
      if (responseType === 'html') {
        if (!text.includes('teacherportal') || !text.includes('<'))
          throw new Error('A página recebida do 7Edu não corresponde à tela esperada.');
        return text;
      }
      if (!/\bjson\b/i.test(response.headers.get('content-type') || ''))
        throw new Error('7Edu não retornou JSON. A sessão pode ter expirado; verifique o diário antes de repetir.');
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { throw new Error('Resposta JSON inválida do 7Edu. Não repita um envio sem verificar o diário.'); }
      if (responseType === 'save') {
        if (typeof parsed !== 'string' || !ID.test(parsed))
          throw new Error('7Edu não confirmou o identificador do lançamento. Verifique o diário antes de tentar novamente.');
      }
      return parsed;
    }
    const homeHtml = await request('/teacherportal/', null, 'html');
    const homeDoc = new DOMParser().parseFromString(homeHtml, 'text/html');
    const termId = homeDoc.querySelector('input[name="academicTermSelectedId"]')?.value;
    if (!ID.test(termId || '') || !/"Code"\s*:\s*"2026-AL"/.test(homeHtml))
      throw new Error('O 7Edu não confirmou o ano letivo 2026. Selecione 2026 em Minhas disciplinas.');
    const opened = await request('/teacherportal/Home/GetListOpenedSectionByEmployee', {
      sort: '', group: '', filter: '', employeeId, academicTermId: termId, programOfferedId: '', courseId: ''
    });
    if (!Array.isArray(opened?.Data) || opened.Errors)
      throw new Error('A consulta de disciplinas do 7Edu falhou ou retornou uma estrutura desconhecida.');
    const classes = opened.Data.filter(row => row?.AcademicTermId === termId && ID.test(row.Identity || ''));
    if (!classes.length) throw new Error('Nenhuma disciplina de 2026 foi localizada para este docente no 7Edu.');
    if (input.action === 'status')
      return {ok: true, data: {status: 'conexao_ok', year: '2026', sections: classes.length}};
    const post = input.post;
    if (!post || !/^[123]M[AB]$/.test(safe(post.turma)) || !/^2026-(09|10|11|12)-\d\d$/.test(safe(post.data)))
      throw new Error('Aula, turma ou data não corresponde ao calendário autorizado de 2026.');
    if (!['Matemática', 'Investigação Matemática', 'Filosofia'].includes(post.disciplina))
      throw new Error('Disciplina não contemplada pelo calendário.');
    if (!safe(post.titulo).trim() || !safe(post.conteudo_7edu).trim())
      throw new Error('O título ou conteúdo convertido para o diário do 7Edu está vazio.');
    if (!Array.isArray(post.horario) || post.horario.length === 0 || post.horario.length !== post.quantidade_periodos)
      throw new Error('A quantidade de períodos não confere com o horário da aula; lançamento bloqueado.');
    const wantedGroup = `EMERE0${post.turma[0]}M${post.turma[2]}`;
    const matching = classes.filter(row => row.CourseOfferingGroup === wantedGroup && norm(row.Name) === norm(post.disciplina));
    if (matching.length !== 1) throw new Error(`Não foi possível identificar sem ambiguidade ${post.turma} / ${post.disciplina} no cadastro do 7Edu.`);
    const section = matching[0];
    const subterms = (section.SectionSubtermList || []).filter(s => s?.AcademicSubterm?.StandardSubtermCode === 'BIM04' &&
      asIsoDate(s.AcademicSubterm.StartDate) <= post.data && asIsoDate(s.AcademicSubterm.EndDate) >= post.data && ID.test(s.Identity || ''));
    if (subterms.length !== 1) throw new Error(`A data ${post.data} não pertence a um único 4º bimestre válido no 7Edu.`);
    const subterm = subterms[0];
    const sectionUrl = `/teacherportal/ClassMeeting?employeeId=${encodeURIComponent(employeeId)}&sectionId=${encodeURIComponent(section.Identity)}&groupId=${encodeURIComponent(section.TermCourseOfferingGroupId)}`;
    const classHtml = await request(sectionUrl, null, 'html');
    const classDoc = new DOMParser().parseFromString(classHtml, 'text/html');
    const choices = Array.from(classDoc.querySelectorAll('select[name="SectionItemId"] option[value]')).filter(el => ID.test(el.value));
    const chosen = choices.filter(el => el.hasAttribute('selected'));
    const selected = chosen.length === 1 ? chosen[0] : choices.length === 1 ? choices[0] : null;
    if (!selected) throw new Error('O 7Edu apresentou várias disciplinas-filhas. Selecione a disciplina manualmente; não farei um mapeamento incerto.');
    if (selected.getAttribute('data-attendancetype') !== '0')
      throw new Error('O tipo de controle de presença difere do fluxo observado. Revise esta turma no 7Edu antes de lançar.');
    const sectionItemId = selected.value;
    const grid = await request('/teacherportal/ClassMeeting/Grid_Read', {
      sort: '', group: '', filter: '', sectionItemId,
      courseOfferingSectionSubtermId: subterm.Identity, employeeId
    });
    if (!Array.isArray(grid?.Data) || grid.Errors || !Number.isInteger(grid.Total) || grid.Total > grid.Data.length)
      throw new Error('O 7Edu não devolveu a lista completa de aulas. Não é seguro verificar duplicatas.');
    const existing = grid.Data.filter(row => asIsoDate(row.RealizedDate) === post.data);
    const result = {turma: post.turma, disciplina: post.disciplina, data: post.data,
      aulas_no_dia: existing.length, tipo_consultado: '7Edu — Aulas Ministradas',
      status: 'conexao_ok'};
    if (input.action === 'check') return {ok: true, data: result};
    if (input.action !== 'publish') throw new Error('Ação não reconhecida.');
    if (existing.length) return {ok: true, data: {status: 'ja_existente', detail: 'Já existe aula realizada nessa data, turma e disciplina no 7Edu. Nenhuma alteração feita.'}};
    if (post.data > today()) throw new Error('O 7Edu registra aulas ministradas: o lançamento de uma data futura está bloqueado.');
    // A interface do 7Edu permite lançamento mesmo com linha prevista pendente.
    // Só RealizedDate indica que uma aula foi efetivamente lançada.
    const schedule = await request('/teacherportal/ClassMeeting/GetListScheduleTemplateItemByTerm', {
      sectionItemId, employeeId, realizationDate: asBrDate(post.data),
      courseOfferingSectionId: section.Identity, isBoosterClass: 'false'
    });
    if (!Array.isArray(schedule) || !schedule.length)
      throw new Error('O 7Edu não retornou horários para essa data; revise o diário antes de lançar.');
    const unused = schedule.filter(x => ID.test(x.Identity || '') && ID.test(x.ScheduleTemplateId || '') &&
      Number.isInteger(x.Priority) && Number.isInteger(x.WeekDay) && minute(x.StartTime) >= 0 && minute(x.EndTime) >= 0);
    if (unused.length !== schedule.length)
      throw new Error('O 7Edu retornou horários incompletos/inválidos. Lançamento bloqueado.');
    const picked = [];
    for (const h of post.horario) {
      const matches = unused.filter(x => Math.abs(minute(x.StartTime) - minute(h.inicio)) <= 1 &&
        Math.abs(minute(x.EndTime) - minute(h.fim)) <= 5);
      if (matches.length !== 1)
        throw new Error(`Horário ${h.inicio}–${h.fim} não corresponde de forma única ao horário no 7Edu. Revise manualmente.`);
      picked.push(matches[0]);
      unused.splice(unused.indexOf(matches[0]), 1);
    }
    if (picked.length !== post.quantidade_periodos) throw new Error('Número de períodos incompatível.');
    // O HTML da postagem original não é transmitido: o diário registra texto simples.
    // A conversão é exibida na prévia e viaja no payload. Mantemos a validação do conteúdo.
    const content = safe(post.conteudo_7edu).trim();
    if (content.length > 20000) throw new Error('Texto excede o limite conservador de 20.000 caracteres para o diário. Edite o conteúdo antes de lançar.');
    const savePayload = {
      AcademicSubterm: null, AcademicTerm: null, ChildrenCourse: null, ClassList: null,
      ClassMeetingList: picked.map(x => ({RealizedSchedule: {
        EndTime: x.EndTime, Identity: x.Identity, Priority: x.Priority,
        ScheduleTemplateId: x.ScheduleTemplateId, StartTime: x.StartTime, WeekDay: x.WeekDay
      }})),
      Course: null, CourseActivity: null, CourseOfferingCode: null, CourseOfferingGroup: null,
      CourseOfferingSection: null, CourseOfferingSectionSubtermId: subterm.Identity,
      ExpectedDate: null, Identity: UUID_ZERO, IsBoosterClass: false, IsCompensation: false,
      IsCompleted: false, MeetingDate: null, RealizedContentAll: content, RealizedDate: asBrDate(post.data),
      RealizedFinalDate: null, QtyClasses: null, SameContentForGroup: true,
      SectionItemId: sectionItemId, SectionItem: null, CourseOfferingSectionStatus: 0,
      SectionAttendanceControlType: 0, AttendanceType: 0, MeetingWeekDay: 0, SectionSubtermStatus: 0,
      IsRequiredGroupEnrollment: false, RealizedContentPartial: null, HasHybridClass: false
    };
    // Único POST que altera dados. Jamais repetir automaticamente, inclusive após erro.
    const savedId = await request('/teacherportal/ClassMeeting/Save', savePayload, 'save');
    return {ok: true, data: {status: 'criado', post_id: savedId, detail: 'Registro gravado no 7Edu; confira o diário.'}};
  } catch (error) {
    return {ok: false, error: safeError(error)};
  }
  function safeError(error) {
    // Nunca retornar corpo HTML, cabeçalhos, cookies, token ou URL com dados de sessão.
    const message = String(error?.message || error || 'Falha não identificada');
    return message.length > 350 ? message.slice(0, 350) : message;
  }
}

async function sevenEduPublish(item, options = {}) {
  if (!item || !/^[123]M[AB]$/.test(item.turma || '') || !item.html?.trim())
    throw new Error('Aula inválida no pacote de planejamento.');
  if (item.status === 'revisao_pedagogica' && !options.approveCondensed)
    throw new Error('A condensação precisa de aprovação explícita.');
  if (item.status === 'proposta_para_aprovacao' && !options.approveProposals)
    throw new Error('As propostas sem plano-fonte precisam de aprovação explícita.');
  if (!['pronto_para_conferencia', 'revisao_pedagogica', 'proposta_para_aprovacao'].includes(item.status))
    throw new Error('Registro sem situação pedagógica autorizada.');
  const key = `posted_7edu_${item.id}`;
  const local = (await chrome.storage.local.get(key))[key];
  if (local) return {status: 'ja_registrado', detail: 'Registro anterior identificado no histórico local do 7Edu.', post_id: local.post_id};
  // O token não sai da aba. Apenas dados pedagógicos do planejamento são enviados.
  const result = await sevenEduCall('publish', item, options);
  if (result.status === 'criado') {
    await chrome.storage.local.set({[key]: {
      post_id: result.post_id, system: '7edu', created_at: new Date().toISOString(),
      turma: item.turma, disciplina: item.disciplina, data: item.data
    }});
  }
  return result;
}
