import React from 'react';
import PropTypes from 'prop-types';
import ImmutablePropTypes from 'react-immutable-proptypes';
import styled from '@emotion/styled';
import { AuthenticationPage, Icon, buttons, shadows, colors, colorsRaw } from 'netlify-cms-ui-default';

const LoginButton = styled.button`
	${buttons.button}
	${shadows.dropDeep}
	${buttons.default}
	${buttons.gray}

	padding: 0 30px;
	display: block;
	margin-top: 20px;
	margin-left: auto;
`;

const AuthForm = styled.form`
	width:350px;
	margin-top: -80px;
`;

const AuthInput = styled.input`
	background-color: ${ colorsRaw.white };
	padding: 10px 10px;

	width: 100%;

	&:focus {
		outline: none;
		box-shadow: inset 0 0 0 2px ${colors.active}
	}
`;

//	margin: 10px;
//	z-index: 1;

const ErrorMessage = styled.p`
	color: ${ colors.errorText }
`;

export default class WebDAVAuthenticationPage extends React.Component {
	constructor(props) {
		super(props);
		// TODO: state?
		this.state = { username: '', password: '', errors: {} };
	}

	inputChangeState(prop, e) {
		this.setState({ ...this.state,[prop]: e.target.value});
	}

	static propTypes = {
		onLogin: PropTypes.func.isRequired,
		inProgress: PropTypes.bool,
		config: ImmutablePropTypes.map.isRequired,
	};
	
	componentDidMount() {}

	handleLogin = e => {
		e.preventDefault();
		this.props.onLogin( this.state );
	};

	render() {
		const {config, inProgress, error } = this.props;
		
		return <AuthenticationPage
			logoUrl={ config.get('logo_url') }
			renderPageContent={()=>(
				<AuthForm onSubmit={ this.handleLogin }>
					<p> { config.get('backend').get('url') }</p>
					{ !error ? null : <ErrorMessage>{error}</ErrorMessage> }
					<AuthInput
						type="text"
						name="username"
						placeholder="Username"
						value={ this.state.username }
						disabled={ inProgress }
						onChange={ (e)=>this.inputChangeState('username',e) }
					/>
					<AuthInput
						type="password"
						name="password"
						placeholder="Password"
						value={ this.state.password }
						disabled={ inProgress }
						onChange={ (e)=>this.inputChangeState('password',e) }
					/>
					<LoginButton disabled={inProgress}>
						{ inProgress ? "Logging in..." : "Login" }
					</LoginButton>
				</AuthForm>
//				<div>Hello world</div>
			)}
		/>
	}
};
