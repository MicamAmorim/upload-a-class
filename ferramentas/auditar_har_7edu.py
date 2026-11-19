#!/usr/bin/env python3
"""Audita somente a ESTRUTURA do HAR de 7Edu, sem imprimir dados pessoais.

Uso: python ferramentas/auditar_har_7edu.py /caminho/para/captura.har
Nunca coloque o próprio HAR em um ZIP compartilhado: ele pode ter cookies.
"""
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

EXPECTED = {
    '/teacherportal/': 'POST',
    '/teacherportal/Home/GetListOpenedSectionByEmployee': 'POST',
    '/teacherportal/ClassMeeting': 'POST',
    '/teacherportal/ClassMeeting/Grid_Read': 'POST',
    '/teacherportal/ClassMeeting/GetListScheduleTemplateItemByTerm': 'POST',
    '/teacherportal/ClassMeeting/Save': 'POST',
}
SAVE_FIELDS = {'ClassMeetingList', 'CourseOfferingSectionSubtermId', 'Identity', 'RealizedContentAll',
               'RealizedDate', 'SameContentForGroup', 'SectionItemId'}


def audit(filename: Path) -> int:
    source = json.loads(filename.read_text(encoding='utf-8-sig'))
    entries = source.get('log', {}).get('entries', [])
    seen = set()
    has_save_pattern = False
    has_list_pattern = False
    has_grid_pattern = False
    for entry in entries:
        request = entry.get('request', {})
        url = urlparse(request.get('url', ''))
        if url.hostname != '7edu-br.educadventista.org':
            continue
        if EXPECTED.get(url.path) != request.get('method'):
            continue
        seen.add(url.path)
        if url.path.endswith('/Save'):
            try:
                p = json.loads(request.get('postData', {}).get('text') or '{}')
            except (ValueError, TypeError):
                continue
            has_save_pattern |= (SAVE_FIELDS <= set(p) and isinstance(p.get('ClassMeetingList'), list)
                                 and all('RealizedSchedule' in x for x in p['ClassMeetingList']))
        if url.path.endswith('/GetListOpenedSectionByEmployee'):
            try:
                data = json.loads(entry['response']['content']['text']).get('Data', [])
            except (KeyError, ValueError, TypeError):
                continue
            has_list_pattern |= any('SectionSubtermList' in x and 'TermCourseOfferingGroupId' in x
                                    for x in data if isinstance(x, dict))
        if url.path.endswith('/Grid_Read'):
            try:
                body = json.loads(entry['response']['content']['text'])
            except (KeyError, ValueError, TypeError):
                continue
            has_grid_pattern |= isinstance(body.get('Data'), list) and isinstance(body.get('Total'), int)
    missing = set(EXPECTED) - seen
    print('HAR analisado sem exibir URLs completas, IDs, cookies, tokens ou conteúdo docente.')
    print('Rotas exigidas:', len(EXPECTED), '| rotas encontradas:', len(seen), '| faltantes:', len(missing))
    print('Formato de gravação (Save):', 'compatível' if has_save_pattern else 'não confirmado')
    print('Lista de disciplinas:', 'compatível' if has_list_pattern else 'não confirmada')
    print('Lista de aulas:', 'compatível' if has_grid_pattern else 'não confirmada')
    if missing:
        print('Rotas faltantes (sem informações de sessão):', ', '.join(sorted(missing)))
    success = not missing and all((has_save_pattern, has_list_pattern, has_grid_pattern))
    print('RESULTADO:', 'PASSOU' if success else 'REVISÃO NECESSÁRIA')
    return 0 if success else 1


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Uso: python auditar_har_7edu.py <arquivo.har>')
    sys.exit(audit(Path(sys.argv[1])))
