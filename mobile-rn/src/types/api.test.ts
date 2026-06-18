import {
  memberFromApi,
  memberToApi,
  sessionFromApi,
  memberPackageFromApi,
} from './api';

describe('memberFromApi', () => {
  it('first_name + last_name yoksa name alanını kullanır', () => {
    const m = memberFromApi({ id: 1, name: 'Ali Veli', member_no: 'M1' });
    expect(m.name).toBe('Ali Veli');
    expect(m.memberNo).toBe('M1');
  });

  it('name yoksa first/last birleştirir', () => {
    const m = memberFromApi({ id: 2, first_name: 'Ayşe', last_name: 'Yılmaz' });
    expect(m.name).toBe('Ayşe Yılmaz');
    expect(m.firstName).toBe('Ayşe');
  });

  it('eksik alanlari bos/null degerlere indirger', () => {
    const m = memberFromApi({ id: 3 });
    expect(m.email).toBe('');
    expect(m.cardNo).toBeNull();
    expect(m.deletedAt).toBeNull();
  });
});

describe('memberToApi', () => {
  it('camelCase -> snake_case çevirir, cardNo undefined ise gönderilmez', () => {
    const body = memberToApi({ firstName: 'Can', lastName: 'Su', phone: '555' });
    expect(body.first_name).toBe('Can');
    expect(body.last_name).toBe('Su');
    // cardNo verilmedi -> card_no undefined (JSON.stringify atar, gönderilmez)
    expect(body.card_no).toBeUndefined();
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('card_no');
  });

  it('memberNo verilirse member_no ekler', () => {
    const body = memberToApi({ firstName: 'Can', memberNo: 'M9' });
    expect(body.member_no).toBe('M9');
  });
});

describe('sessionFromApi', () => {
  it('start/end ts sayıya çevrilir, member adı türetilir', () => {
    const s = sessionFromApi({
      id: 10,
      start_ts: '1700000000000',
      end_ts: '1700003600000',
      member_first_name: 'Deniz',
      member_last_name: 'Ak',
    });
    expect(s.startTs).toBe(1700000000000);
    expect(typeof s.endTs).toBe('number');
    expect(s.memberName).toBe('Deniz Ak');
  });
});

describe('memberPackageFromApi', () => {
  it('slots day_of_week -> dayOfWeek map eder', () => {
    const p = memberPackageFromApi({
      id: 5,
      member_id: 1,
      package_id: 2,
      slots: [{ id: 1, day_of_week: 3, start_time: '10:00', staff_id: 7 }],
    });
    expect(p.slots[0].dayOfWeek).toBe(3);
    expect(p.slots[0].startTime).toBe('10:00');
    expect(p.status).toBe('active');
  });
});
