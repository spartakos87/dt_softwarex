from utils.passwords import hash_password, verify_password


def test_hash_is_salted_and_verifiable():
    password = 'correct horse battery staple'
    first = hash_password(password)
    second = hash_password(password)
    assert first != second
    assert verify_password(password, first)
    assert not verify_password('wrong guess', first)
    assert not verify_password(password, 'admin123!')


def test_short_passwords_refused():
    try:
        hash_password('short')
        assert False, 'Password must be rejected'
    except ValueError:
        pass
